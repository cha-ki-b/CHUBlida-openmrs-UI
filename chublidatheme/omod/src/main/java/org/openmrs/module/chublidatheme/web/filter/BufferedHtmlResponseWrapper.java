package org.openmrs.module.chublidatheme.web.filter;

import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;

/**
 * Captures a response only while it still looks like an HTML page.
 * <p>
 * Buffering every response would mean holding PDFs, DICOM payloads and report exports in memory for
 * no reason. So the decision is deferred to the first write: by then the content type is known, and
 * anything that is not HTML is streamed straight through to the container untouched.
 */
class BufferedHtmlResponseWrapper extends HttpServletResponseWrapper {

	private final HttpServletResponse delegate;

	private ByteArrayOutputStream buffer;

	private ServletOutputStream stream;

	private PrintWriter writer;

	/** null until the first write forces the decision. */
	private Boolean capturing;

	BufferedHtmlResponseWrapper(HttpServletResponse response) {
		super(response);
		this.delegate = response;
	}

	/**
	 * @return true when the response was buffered and is available via {@link #getCapturedText()}
	 */
	boolean isCapturing() {
		return Boolean.TRUE.equals(capturing);
	}

	private boolean decideCapture() {
		if (capturing == null) {
			String contentType = delegate.getContentType();
			capturing = contentType != null
			        && contentType.toLowerCase().contains("text/html");
			if (capturing) {
				buffer = new ByteArrayOutputStream(32 * 1024);
			}
		}
		return capturing;
	}

	@Override
	public ServletOutputStream getOutputStream() throws IOException {
		if (writer != null) {
			throw new IllegalStateException("getWriter() has already been called on this response");
		}
		if (stream == null) {
			stream = new ServletOutputStream() {

				@Override
				public void write(int b) throws IOException {
					if (decideCapture()) {
						buffer.write(b);
					} else {
						delegate.getOutputStream().write(b);
					}
				}

				@Override
				public void write(byte[] b, int off, int len) throws IOException {
					if (decideCapture()) {
						buffer.write(b, off, len);
					} else {
						delegate.getOutputStream().write(b, off, len);
					}
				}

				@Override
				public void flush() throws IOException {
					if (!isCapturing()) {
						delegate.getOutputStream().flush();
					}
				}

				@Override
				public boolean isReady() {
					return true;
				}

				@Override
				public void setWriteListener(WriteListener writeListener) {
					// Synchronous writing only; the container never drives this asynchronously here.
				}
			};
		}
		return stream;
	}

	@Override
	public PrintWriter getWriter() throws IOException {
		if (stream != null) {
			throw new IllegalStateException("getOutputStream() has already been called on this response");
		}
		if (writer == null) {
			// Route through getOutputStream() so the capture decision stays in one place.
			writer = new PrintWriter(new OutputStreamWriter(getOutputStream(), getCharacterEncoding()), false);
		}
		return writer;
	}

	@Override
	public void flushBuffer() throws IOException {
		if (writer != null) {
			writer.flush();
		}
		if (!isCapturing()) {
			super.flushBuffer();
		}
	}

	/**
	 * Content-Length is set before the body is written, so it is stale the moment we add a link tag.
	 * Suppressing it lets the container work out the real length.
	 */
	@Override
	public void setContentLength(int len) {
		if (!isCapturing()) {
			super.setContentLength(len);
		}
	}

	@Override
	public void setContentLengthLong(long len) {
		if (!isCapturing()) {
			super.setContentLengthLong(len);
		}
	}

	@Override
	public void setHeader(String name, String value) {
		if (isCapturing() && "Content-Length".equalsIgnoreCase(name)) {
			return;
		}
		super.setHeader(name, value);
	}

	@Override
	public void addHeader(String name, String value) {
		if (isCapturing() && "Content-Length".equalsIgnoreCase(name)) {
			return;
		}
		super.addHeader(name, value);
	}

	/**
	 * Drains the PrintWriter created by {@link #getWriter()}.
	 * <p>
	 * That writer is deliberately not auto-flushing, so a response smaller than its internal
	 * buffer (8 KB) never reaches {@link #getOutputStream()} while the filter chain is running.
	 * Until it does, {@link #decideCapture()} has not run and {@code capturing} is still null - so
	 * the filter would conclude there was nothing to do and return, discarding the whole body.
	 * That is what blanked the AngularJS administration views, whose templates are around 1 KB.
	 * <p>
	 * Calling this once the chain has returned forces the decision and moves every byte either
	 * into the capture buffer or straight out to the container.
	 */
	void finishResponse() throws IOException {
		if (writer != null) {
			writer.flush();
		} else if (stream != null) {
			stream.flush();
		}
	}

	String getCapturedText() throws UnsupportedEncodingException {
		flushWriter();
		return buffer == null ? null : buffer.toString(getCharacterEncoding());
	}

	/** Writes bytes that were captured but are not being rewritten. */
	void passThroughUnmodified() throws IOException {
		flushWriter();
		if (buffer != null && buffer.size() > 0) {
			delegate.getOutputStream().write(buffer.toByteArray());
		}
	}

	void writeModified(String html) throws IOException {
		byte[] bytes = html.getBytes(getCharacterEncoding());
		delegate.setContentLength(bytes.length);
		delegate.getOutputStream().write(bytes);
	}

	private void flushWriter() {
		if (writer != null) {
			writer.flush();
		}
	}

	@Override
	public String getCharacterEncoding() {
		String encoding = super.getCharacterEncoding();
		return encoding == null ? "UTF-8" : encoding;
	}
}
