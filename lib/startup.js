/**
 * This file is part of AdBlocker Ultimate Browser Extension
 *
 * AdBlocker Ultimate Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdBlocker Ultimate Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with AdBlocker Ultimate Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Checks if the filter signatures need to be updated and triggers the update.
 */
function checkAndUpdateFilters() {
    const now = new Date(),
	lastUpdate = abu.localStorage.getItem('lastFilterUpdateTime');
	
	const isOutdated = !lastUpdate || (now.getTime() - lastUpdate > 604800000);
	const isQuietHour = now.getHours() >= 1 && now.getHours() <= 5;
	
	if (isOutdated || isQuietHour) {
        if (typeof abu.filters.updateAllEnabledFilters === 'function') {
            abu.filters.updateAllEnabledFilters(true, (success) => {
                if (success) {
                    abu.localStorage.setItem('lastFilterUpdateTime', now.getTime());
					
                    abu.console.info('Filters updated successfully.');
                } else {
                    abu.console.error('Failed to update the filters.');
                }
            });
        } else {
            abu.console.warn('The function `abu.filters.updateAllEnabledFilters` was not found. Unable to update the filters.');
        }
    }
}

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'filterUpdateAlarm') checkAndUpdateFilters();
});

abu.initialize = (initCallback = () => {}) => {
	
	abu.localStorage.init (() => {
		chrome.alarms.create('filterUpdateAlarm', { periodInMinutes: 1440 });
		
		checkAndUpdateFilters();
		
		abu.filters.start({
			onInstall: (callback) => {
				abu.filters.offerFilters(filterIds => {
					abu.filters.addAndEnableFilters(filterIds, callback);
				});
			},
		}, initcallBack);
	});
};
