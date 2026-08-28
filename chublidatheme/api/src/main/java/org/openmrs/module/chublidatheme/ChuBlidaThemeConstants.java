package org.openmrs.module.chublidatheme;

/**
 * Shared constants for the CHU Blida theme module.
 */
public final class ChuBlidaThemeConstants {

	private ChuBlidaThemeConstants() {
	}

	public static final String MODULE_ID = "chublidatheme";

	/**
	 * Master switch. Setting this to false leaves the module running but stops all injection, so the
	 * stock OpenMRS look returns without an admin having to stop the module.
	 */
	public static final String GP_ENABLED = "chublidatheme.enabled";

	/**
	 * When true, the filter stamps dir="rtl" on the html element for right-to-left locales. The
	 * Reference Application does not do this itself, so Arabic would otherwise render left-to-right.
	 */
	public static final String GP_RTL_AUTO = "chublidatheme.autoRtl";

	/**
	 * Cache-busting suffix for the injected asset URLs. Bumped on release, or changed by hand during
	 * on-site tuning so browsers pick up an edited stylesheet.
	 */
	public static final String GP_ASSET_VERSION = "chublidatheme.assetVersion";

	public static final String DEFAULT_ASSET_VERSION = "1.0.5";

	/**
	 * Comma-separated URL fragments the filter must not touch, on top of the built-in list.
	 * Editable at runtime so a page that misbehaves can be excluded immediately, without a
	 * rebuild and without turning the whole theme off.
	 */
	public static final String GP_SKIP_PATHS = "chublidatheme.skipPaths";

	/** Language codes that must be rendered right-to-left. */
	public static final String[] RTL_LANGUAGES = { "ar", "fa", "he", "ur" };
}
