import { AntiBannerFiltersId } from '../../../common/constants';

const GROUP_ID_TO_CATEGORY = {
  0: 'custom', // CustomFiltersGroupId
  1: 'ad-blocking', // AdBlockingFiltersGroupId
  2: 'privacy', // PrivacyFiltersGroupId
  3: 'security', // SecurityFiltersGroupId
  4: 'language', // LanguageFiltersGroupId
};

export const getCategoryFromGroupId = (groupId) => {
  return GROUP_ID_TO_CATEGORY[groupId] || null;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'];

function getOrdinalSuffix(n) {
  const v = n % 100;
  return n + (ORDINAL_SUFFIXES[(v - 20) % 10] || ORDINAL_SUFFIXES[v] || ORDINAL_SUFFIXES[0]);
}

/**
 * Format timestamp (milliseconds) to readable date string
 * Format: "Last update: 12th December, 14:02"
 */
export const formatDate = (dateMs) => {
  if (!dateMs || dateMs === 0) {
    return '';
  }

  const dateObj = new Date(dateMs);
  const dayWithOrdinal = getOrdinalSuffix(dateObj.getDate());
  const month = MONTH_NAMES[dateObj.getMonth()];

  // Format time as HH:MM
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `Last update: ${dayWithOrdinal} ${month}, ${hours}:${minutes}`;
};

export function filterFilters(filters, search) {
  const { category, query, status } = search;

  return filters.filter((filter) => {
    // Anti-circumvention is shown as a toggle in General settings tab, not in Filters tab
    if (filter.filterId === AntiBannerFiltersId.AntiCircumventionFilterId) {
      return false;
    }

    const filterCategory = getCategoryFromGroupId(filter.groupId);

    if (!filterCategory && !query && !status) {
      return false;
    }

    if (category && filterCategory !== category) {
      return false;
    }

    const queryStringMatches = query && filter.name?.toLowerCase().includes(query.toLowerCase());

    if (query && !queryStringMatches) {
      return false;
    }

    if (status === 'enabled' && !filter.enabled) {
      return false;
    }

    if (status === 'disabled' && filter.enabled) {
      return false;
    }

    return true;
  });
}
