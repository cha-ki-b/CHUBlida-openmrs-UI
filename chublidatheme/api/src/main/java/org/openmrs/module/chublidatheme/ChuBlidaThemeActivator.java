package org.openmrs.module.chublidatheme;

import org.openmrs.module.BaseModuleActivator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Lifecycle hooks for the CHU Blida theme.
 * <p>
 * The module is presentation-only: it creates no tables, touches no clinical data, and holds no
 * state. Stopping it removes every visual change immediately, which is the intended kill switch.
 */
public class ChuBlidaThemeActivator extends BaseModuleActivator {

	private static final Logger log = LoggerFactory.getLogger(ChuBlidaThemeActivator.class);

	@Override
	public void started() {
		log.info("CHU Blida theme started - branding is now applied to all pages");
	}

	@Override
	public void stopped() {
		log.info("CHU Blida theme stopped - the stock OpenMRS appearance has been restored");
	}
}
