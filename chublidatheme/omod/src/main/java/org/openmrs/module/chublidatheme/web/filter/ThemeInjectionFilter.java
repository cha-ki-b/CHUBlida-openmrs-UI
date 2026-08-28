package org.openmrs.module.chublidatheme.web.filter;

import org.openmrs.api.context.Context;
import org.openmrs.module.chublidatheme.ChuBlidaThemeConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Injects the CHU Blida stylesheet and behaviour script into every HTML page the application
 * produces.
 * <p>
 * This is the one mechanism that reaches all of it. The {@code appui} header extension covers the
 * decorated Reference Application pages, but the login page is a standalone GSP with no extension
 * point, and the 206 legacy administration pages are JSPs outside the UI Framework entirely. A
 * response filter sits underneath all three.
 * <p>
 * Two rules govern everything here. First, <strong>fail open</strong>: any error leaves the original
 * response untouched and is logged, because an unstyled EMR is a minor annoyance and a broken one is
 * a clinical incident. Second, <strong>external references only</strong> - never an inline
 * {@code <style>} or {@code <script>} block, both because CSRFGuard and any future Content-Security-Policy
 * would reject them and because external files stay cacheable.
 */
public class ThemeInjectionFilter implements Filter {

	private static final Logger log = LoggerFactory.getLogger(ThemeInjectionFilter.class);

	private static final Pattern HEAD_CLOSE = Pattern.compile("</head\\s*>", Pattern.CASE_INSENSITIVE);

	private static final Pattern BODY_CLOSE = Pattern.compile("</body\\s*>", Pattern.CASE_INSENSITIVE);

	private static final Pattern HTML_OPEN = Pattern.compile("<html\\b([^>]*)>", Pattern.CASE_INSENSITIVE);

	/**
	 * Marks a response as a complete HTML document rather than a fragment. Several modules serve HTML
	 * partials as text/html: the administration screens are AngularJS apps whose templates
	 * ({@code templates/list.page} and friends) are head-less snippets compiled into the page at
	 * runtime. Those must be returned byte-for-byte, so injection is gated on the response actually
	 * being a document.
	 */
	private static final Pattern HTML_DOCUMENT = Pattern.compile("<html\\b", Pattern.CASE_INSENSITIVE);

	private static final Pattern DIR_ATTR = Pattern.compile("\\bdir\\s*=", Pattern.CASE_INSENSITIVE);

	/**
	 * Paths that never carry a themable page. Skipping them avoids pointless wrapping on the many
	 * asset and API requests a single page load produces.
	 */
	private static final String[] SKIP_PREFIXES = {
	        "/ms/uiframework/resource", "/moduleResources", "/scripts", "/images", "/style",
	        "/ws/", "/dwr/", "/csrfguard", "/openmrs.js", "/favicon"
	};

	private static final String[] SKIP_SUFFIXES = {
	        ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2",
	        ".ttf", ".eot", ".map", ".json", ".pdf", ".zip", ".csv", ".xlsx", ".dcm"
	};

	@Override
	public void init(FilterConfig filterConfig) {
		log.info("CHU Blida theme injection filter initialised");
	}

	@Override
	public void destroy() {
		// No resources held.
	}

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
	        throws IOException, ServletException {

		if (!(request instanceof HttpServletRequest) || !(response instanceof HttpServletResponse)) {
			chain.doFilter(request, response);
			return;
		}

		HttpServletRequest httpRequest = (HttpServletRequest) request;
		HttpServletResponse httpResponse = (HttpServletResponse) response;

		if (shouldSkip(httpRequest) || !isEnabled()) {
			chain.doFilter(request, response);
			return;
		}

		BufferedHtmlResponseWrapper wrapper = new BufferedHtmlResponseWrapper(httpResponse);
		chain.doFilter(request, wrapper);

		// Must happen before anything else: the response's PrintWriter does not auto-flush, so
		// a body smaller than its 8 KB buffer has not reached the wrapper yet and the capture
		// decision has not been made. Skipping this discards the entire response.
		try {
			wrapper.finishResponse();
		}
		catch (Exception e) {
			log.error("Could not finalise the response for " + httpRequest.getRequestURI(), e);
			return;
		}

		if (!wrapper.isCapturing()) {
			// Not HTML - the wrapper streamed it straight through, nothing left to do.
			return;
		}

		String html = null;
		try {
			html = wrapper.getCapturedText();
		}
		catch (Exception e) {
			log.warn("Could not read the captured response; leaving it unmodified", e);
		}

		if (html == null || html.isEmpty()) {
			wrapper.passThroughUnmodified();
			return;
		}

		try {
			String modified = inject(html, httpRequest);
			if (modified.equals(html)) {
				// Nothing to add - a fragment, a partial, or an Angular template.
				// Write the captured bytes back rather than re-encoding the string,
				// so the response is byte-identical to what the page produced.
				wrapper.passThroughUnmodified();
			} else {
				wrapper.writeModified(modified);
			}
		}
		catch (Exception e) {
			// Fail open: the page still renders, just without CHU Blida styling.
			log.error("Theme injection failed for " + httpRequest.getRequestURI()
			        + "; serving the page unstyled", e);
			wrapper.passThroughUnmodified();
		}
	}

	/**
	 * Adds the stylesheet to the head, the script to the end of the body, and a direction attribute
	 * to the html element when the active locale is right-to-left.
	 */
	String inject(String html, HttpServletRequest request) {
		// Fragments and templates are returned untouched. Without this an Angular
		// partial could be handed back with a stylesheet link spliced into it.
		if (!HTML_DOCUMENT.matcher(html).find()) {
			return html;
		}

		String contextPath = request.getContextPath();
		String version = assetVersion();
		String base = contextPath + "/moduleResources/" + ChuBlidaThemeConstants.MODULE_ID;

		String stylesheet = "\n<link rel=\"stylesheet\" type=\"text/css\" href=\""
		        + base + "/styles/chu-theme.css?v=" + version + "\"/>\n"
		        + "<link rel=\"icon\" type=\"image/svg+xml\" href=\""
		        + base + "/images/favicon.svg?v=" + version + "\"/>\n";

		String script = "\n<script type=\"text/javascript\" src=\""
		        + base + "/scripts/chu-theme.js?v=" + version + "\" defer></script>\n";

		String result = html;

		Matcher head = HEAD_CLOSE.matcher(result);
		if (head.find()) {
			result = result.substring(0, head.start()) + stylesheet + result.substring(head.start());
		} else {
			// No head element - a fragment or a hand-rolled page. Nothing safe to do.
			return html;
		}

		Matcher body = BODY_CLOSE.matcher(result);
		if (body.find()) {
			result = result.substring(0, body.start()) + script + result.substring(body.start());
		}

		if (isRtlAutoEnabled()) {
			result = applyTextDirection(result);
		}

		return result;
	}

	/**
	 * The Reference Application never sets a direction attribute, so Arabic renders left-to-right out
	 * of the box. Stamping dir="rtl" here is what makes the logical-property CSS in the theme actually
	 * flip. An existing dir attribute is always respected.
	 */
	private String applyTextDirection(String html) {
		if (!isRtlLocale()) {
			return html;
		}
		Matcher htmlTag = HTML_OPEN.matcher(html);
		if (!htmlTag.find()) {
			return html;
		}
		String attributes = htmlTag.group(1);
		if (DIR_ATTR.matcher(attributes).find()) {
			return html;
		}
		return html.substring(0, htmlTag.start())
		        + "<html" + attributes + " dir=\"rtl\">"
		        + html.substring(htmlTag.end());
	}

	private boolean shouldSkip(HttpServletRequest request) {
		String uri = request.getRequestURI();
		if (uri == null) {
			return true;
		}
		String contextPath = request.getContextPath();
		String path = contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)
		        ? uri.substring(contextPath.length())
		        : uri;

		String lower = path.toLowerCase();
		for (String suffix : SKIP_SUFFIXES) {
			if (lower.endsWith(suffix)) {
				return true;
			}
		}
		for (String prefix : SKIP_PREFIXES) {
			if (lower.startsWith(prefix)) {
				return true;
			}
		}
		// Operator-configurable exclusions, so a misbehaving page can be taken out of the
		// filter's path at runtime rather than waiting for a new build.
		for (String fragment : configuredSkipPaths()) {
			if (lower.contains(fragment)) {
				return true;
			}
		}

		// Sec-Fetch-Dest is sent by every current browser and states what the response is for.
		// Anything that is not a top-level document - fetch, XHR, an Angular template, an
		// iframe's sub-resource - is left completely alone.
		String fetchDest = request.getHeader("Sec-Fetch-Dest");
		if (fetchDest != null && !"document".equals(fetchDest) && !"iframe".equals(fetchDest)
		        && !"frame".equals(fetchDest)) {
			return true;
		}

		// UI Framework fragment actions return HTML snippets that get spliced into a live page;
		// injecting a stylesheet link into those would duplicate it on every interaction.
		return lower.contains("/fragmentaction") || "XMLHttpRequest".equals(request.getHeader("X-Requested-With"));
	}

	/** @return lower-cased URL fragments from {@code chublidatheme.skipPaths}, never null */
	private String[] configuredSkipPaths() {
		try {
			if (!Context.isSessionOpen()) {
				return new String[0];
			}
			String value = Context.getAdministrationService()
			        .getGlobalProperty(ChuBlidaThemeConstants.GP_SKIP_PATHS);
			if (value == null || value.trim().isEmpty()) {
				return new String[0];
			}
			String[] parts = value.toLowerCase().split(",");
			for (int i = 0; i < parts.length; i++) {
				parts[i] = parts[i].trim();
			}
			return parts;
		}
		catch (Exception e) {
			return new String[0];
		}
	}

	private boolean isEnabled() {
		return booleanProperty(ChuBlidaThemeConstants.GP_ENABLED, true);
	}

	private boolean isRtlAutoEnabled() {
		return booleanProperty(ChuBlidaThemeConstants.GP_RTL_AUTO, true);
	}

	private boolean booleanProperty(String property, boolean fallback) {
		try {
			if (!Context.isSessionOpen()) {
				return fallback;
			}
			String value = Context.getAdministrationService().getGlobalProperty(property);
			return value == null || value.trim().isEmpty() ? fallback : Boolean.parseBoolean(value.trim());
		}
		catch (Exception e) {
			return fallback;
		}
	}

	private String assetVersion() {
		try {
			if (Context.isSessionOpen()) {
				String value = Context.getAdministrationService()
				        .getGlobalProperty(ChuBlidaThemeConstants.GP_ASSET_VERSION);
				if (value != null && !value.trim().isEmpty()) {
					return value.trim();
				}
			}
		}
		catch (Exception e) {
			log.debug("Falling back to the default asset version", e);
		}
		return ChuBlidaThemeConstants.DEFAULT_ASSET_VERSION;
	}

	private boolean isRtlLocale() {
		Locale locale;
		try {
			locale = Context.isSessionOpen() ? Context.getLocale() : null;
		}
		catch (Exception e) {
			locale = null;
		}
		if (locale == null) {
			return false;
		}
		String language = locale.getLanguage();
		for (String rtl : ChuBlidaThemeConstants.RTL_LANGUAGES) {
			if (rtl.equals(language)) {
				return true;
			}
		}
		return false;
	}
}
