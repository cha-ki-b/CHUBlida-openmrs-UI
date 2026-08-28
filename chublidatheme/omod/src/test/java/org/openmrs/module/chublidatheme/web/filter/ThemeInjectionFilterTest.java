package org.openmrs.module.chublidatheme.web.filter;

import org.junit.Before;
import org.junit.Test;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletOutputStream;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/**
 * The filter sits in front of every response the application produces, so the property that
 * matters most is not "does it inject correctly" but "does every byte the application wrote
 * still reach the browser".
 */
public class ThemeInjectionFilterTest {

	private ThemeInjectionFilter filter;

	private CapturingResponse response;

	@Before
	public void setUp() {
		filter = new ThemeInjectionFilter();
		response = new CapturingResponse();
	}

	/**
	 * Regression test for the blank "Manage Global Properties" screen.
	 * <p>
	 * The administration screens are AngularJS apps whose views are fetched from
	 * {@code templates/list.page}. Those responses are small HTML fragments written through
	 * {@link HttpServletResponse#getWriter()}. The wrapper's PrintWriter is created with
	 * autoFlush disabled, so anything still sitting in its buffer when the filter finished was
	 * discarded - the browser received an empty body, Angular compiled nothing, and the page
	 * rendered blank.
	 */
	@Test
	public void doFilter_shouldNotLoseBodyWrittenThroughWriterWhenResponseIsNotCaptured()
	        throws IOException, ServletException {

		final String body = "<button ui-sref=\"edit\">Add</button><table><thead><tr><th>Name</th></tr></thead></table>";

		filter.doFilter(request("/openmrs/adminui/systemadmin/globalproperties/templates/list.page"),
		    response, new FilterChain() {

			    @Override
			    public void doFilter(ServletRequest req, ServletResponse res) throws IOException {
				    HttpServletResponse http = (HttpServletResponse) res;
				    // No content type set before the first write - exactly what a UI Framework
				    // fragment does, and what makes the wrapper decline to capture.
				    http.getWriter().write(body);
			    }
		    });

		assertEquals("the fragment must reach the client unchanged", body, response.written());
	}

	/** The same guarantee when the body is written as bytes rather than characters. */
	@Test
	public void doFilter_shouldNotLoseBodyWrittenThroughOutputStream() throws IOException, ServletException {
		final String body = "{\"results\":[{\"uuid\":\"abc\"}]}";

		filter.doFilter(request("/openmrs/somewhere/data.page"), response, new FilterChain() {

			@Override
			public void doFilter(ServletRequest req, ServletResponse res) throws IOException {
				HttpServletResponse http = (HttpServletResponse) res;
				http.setContentType("application/json");
				http.getOutputStream().write(body.getBytes("UTF-8"));
			}
		});

		assertEquals(body, response.written());
	}

	/** A head-less HTML fragment must come back byte-for-byte, with nothing injected. */
	@Test
	public void doFilter_shouldLeaveHtmlFragmentsAlone() throws IOException, ServletException {
		final String fragment = "<div class=\"widget\"><h3>Vitals</h3></div>";

		filter.doFilter(request("/openmrs/adminui/templates/list.page"), response, new FilterChain() {

			@Override
			public void doFilter(ServletRequest req, ServletResponse res) throws IOException {
				HttpServletResponse http = (HttpServletResponse) res;
				http.setContentType("text/html;charset=UTF-8");
				http.getWriter().write(fragment);
			}
		});

		assertEquals("a fragment has no <html>, so nothing may be added", fragment, response.written());
	}

	/** A full document is the only thing that gets the stylesheet and script. */
	@Test
	public void doFilter_shouldInjectIntoFullDocuments() throws IOException, ServletException {
		final String page = "<html><head><title>x</title></head><body><p>hi</p></body></html>";

		filter.doFilter(request("/openmrs/index.htm"), response, new FilterChain() {

			@Override
			public void doFilter(ServletRequest req, ServletResponse res) throws IOException {
				HttpServletResponse http = (HttpServletResponse) res;
				http.setContentType("text/html;charset=UTF-8");
				http.getWriter().write(page);
			}
		});

		String out = response.written();
		assertTrue("stylesheet injected", out.contains("chu-theme.css"));
		assertTrue("script injected", out.contains("chu-theme.js"));
		assertTrue("original content preserved", out.contains("<p>hi</p>"));
		assertTrue("stylesheet lands inside head", out.indexOf("chu-theme.css") < out.indexOf("</head>"));
	}

	/** Static assets must not even be wrapped. */
	@Test
	public void doFilter_shouldSkipAssets() throws IOException, ServletException {
		final String css = "body{color:red}";

		filter.doFilter(request("/openmrs/moduleResources/x/styles/a.css"), response, new FilterChain() {

			@Override
			public void doFilter(ServletRequest req, ServletResponse res) throws IOException {
				((HttpServletResponse) res).getWriter().write(css);
			}
		});

		assertEquals(css, response.written());
	}

	/**
	 * The REST API must be returned byte-for-byte.
	 * <p>
	 * Pinned after a 500 on {@code /ws/rest/v1/systemsetting?includeAll=true&v=default} was
	 * reported while the theme was installed. This is the exact URL the Manage Global
	 * Properties screen calls (uicommons {@code systemSettingService.js} builds
	 * {@code "/" + OPENMRS_CONTEXT_PATH + "/ws/rest/v1/systemsetting/:uuid"}), so the test
	 * records that the filter is not on that path and cannot be responsible for its status.
	 */
	@Test
	public void doFilter_shouldNeverTouchTheRestApi() throws IOException, ServletException {
		final String json = "{\"results\":[{\"property\":\"a.b\",\"value\":\"1\"}]}";

		filter.doFilter(request("/openmrs/ws/rest/v1/systemsetting?includeAll=true&v=default"),
		    response, new FilterChain() {

			    @Override
			    public void doFilter(ServletRequest req, ServletResponse res) throws IOException {
				    HttpServletResponse http = (HttpServletResponse) res;
				    http.setContentType("application/json;charset=UTF-8");
				    http.getWriter().write(json);
			    }
		    });

		assertEquals("REST responses must pass through untouched", json, response.written());
	}

	/**
	 * Documents larger than the PrintWriter's 8 KB buffer flush themselves mid-render, so they
	 * always worked - which is exactly why this defect stayed hidden: nearly every Reference
	 * Application page is over that size. Pinned so the large path cannot regress either.
	 */
	@Test
	public void doFilter_shouldHandleDocumentsLargerThanTheWriterBuffer() throws IOException, ServletException {
		StringBuilder filler = new StringBuilder();
		for (int i = 0; i < 400; i++) {
			filler.append("<p>row ").append(i).append(" ................................</p>");
		}
		final String page = "<html><head><title>big</title></head><body>" + filler + "</body></html>";
		assertTrue("fixture must exceed the 8KB writer buffer", page.length() > 8192);

		filter.doFilter(request("/openmrs/big.page"), response, new FilterChain() {

			@Override
			public void doFilter(ServletRequest req, ServletResponse res) throws IOException {
				HttpServletResponse http = (HttpServletResponse) res;
				http.setContentType("text/html;charset=UTF-8");
				http.getWriter().write(page);
			}
		});

		String out = response.written();
		assertTrue("stylesheet injected", out.contains("chu-theme.css"));
		assertTrue("last row survived", out.contains("row 399"));
		assertEquals("body must not be duplicated", 1, countOccurrences(out, "<title>big</title>"));
		assertEquals("stylesheet must be injected exactly once", 1, countOccurrences(out, "chu-theme.css"));
	}

	/** Flushing before the capture decision must not cause the body to be emitted twice. */
	@Test
	public void doFilter_shouldNotDuplicateSmallDocuments() throws IOException, ServletException {
		final String page = "<html><head></head><body><span>once</span></body></html>";

		filter.doFilter(request("/openmrs/small.page"), response, new FilterChain() {

			@Override
			public void doFilter(ServletRequest req, ServletResponse res) throws IOException {
				HttpServletResponse http = (HttpServletResponse) res;
				http.setContentType("text/html;charset=UTF-8");
				http.getWriter().write(page);
			}
		});

		assertEquals("content written exactly once", 1, countOccurrences(response.written(), "<span>once</span>"));
	}

	private static int countOccurrences(String haystack, String needle) {
		int count = 0, from = 0, at;
		while ((at = haystack.indexOf(needle, from)) != -1) {
			count++;
			from = at + needle.length();
		}
		return count;
	}

	/* ------------------------------------------------------------------ helpers */

	private HttpServletRequest request(final String uri) {
		final Map<String, String> headers = new HashMap<String, String>();
		return (HttpServletRequest) Proxy.newProxyInstance(
		    getClass().getClassLoader(), new Class[] { HttpServletRequest.class }, new InvocationHandler() {

			    @Override
			    public Object invoke(Object proxy, Method method, Object[] args) {
				    String name = method.getName();
				    if ("getRequestURI".equals(name)) {
					    return uri;
				    }
				    if ("getContextPath".equals(name)) {
					    return "/openmrs";
				    }
				    if ("getHeader".equals(name)) {
					    return headers.get(args[0]);
				    }
				    if ("toString".equals(name)) {
					    return "MockRequest[" + uri + "]";
				    }
				    Class<?> rt = method.getReturnType();
				    if (rt == boolean.class) {
					    return Boolean.FALSE;
				    }
				    if (rt == int.class) {
					    return 0;
				    }
				    return null;
			    }
		    });
	}

	/** Collects whatever the filter chain ultimately writes to the real response. */
	private static class CapturingResponse extends HttpServletResponseWrapper {

		private final ByteArrayOutputStream sink = new ByteArrayOutputStream();

		private String contentType;

		private PrintWriter writer;

		CapturingResponse() {
			super(nullResponse());
		}

		String written() throws IOException {
			if (writer != null) {
				writer.flush();
			}
			return new String(sink.toByteArray(), "UTF-8");
		}

		@Override
		public void setContentType(String type) {
			this.contentType = type;
		}

		@Override
		public String getContentType() {
			return contentType;
		}

		@Override
		public String getCharacterEncoding() {
			return "UTF-8";
		}

		@Override
		public ServletOutputStream getOutputStream() {
			return new ServletOutputStream() {

				@Override
				public void write(int b) {
					sink.write(b);
				}

				@Override
				public void write(byte[] b, int off, int len) {
					sink.write(b, off, len);
				}

				@Override
				public boolean isReady() {
					return true;
				}

				@Override
				public void setWriteListener(WriteListener listener) {
				}
			};
		}

		@Override
		public PrintWriter getWriter() throws IOException {
			if (writer == null) {
				writer = new PrintWriter(new OutputStreamWriter(getOutputStream(), "UTF-8"), true);
			}
			return writer;
		}

		@Override
		public void setContentLength(int len) {
		}

		@Override
		public void setHeader(String name, String value) {
		}

		@Override
		public void addHeader(String name, String value) {
		}

		@Override
		public void flushBuffer() {
		}

		private static HttpServletResponse nullResponse() {
			return (HttpServletResponse) Proxy.newProxyInstance(
			    CapturingResponse.class.getClassLoader(), new Class[] { HttpServletResponse.class },
			    new InvocationHandler() {

				    @Override
				    public Object invoke(Object proxy, Method method, Object[] args) {
					    Class<?> rt = method.getReturnType();
					    if (rt == boolean.class) {
						    return Boolean.FALSE;
					    }
					    if (rt == int.class) {
						    return 0;
					    }
					    return null;
				    }
			    });
		}
	}
}
