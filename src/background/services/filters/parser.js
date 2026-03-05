export class FilterParser {
  static #AMOUNT_OF_LINES_TO_PARSE = 50;

  static parseFilterDataFromHeader(rules) {
    return {
      name: FilterParser.#parseTag('Title', rules),
      description: FilterParser.#parseTag('Description', rules),
      homepage: FilterParser.#parseTag('Homepage', rules),
      version: FilterParser.#parseTag('Version', rules),
      expires: Number(FilterParser.#parseTag('Expires', rules)),
      timeUpdated: FilterParser.#parseTag('TimeUpdated', rules),
      diffPath: FilterParser.#parseTag('Diff-Path', rules),
    };
  }

  // Finds value of specified header tag in filter rules text.
  static #parseTag(tagName, rules) {
    let result = '';

    // Look up no more than 50 first lines
    const maxLines = Math.min(FilterParser.#AMOUNT_OF_LINES_TO_PARSE, rules.length);
    for (let i = 0; i < maxLines; i += 1) {
      const rule = rules[i];

      if (!rule) {
        continue;
      }

      const search = `! ${tagName}: `;
      const indexOfSearch = rule.indexOf(search);

      if (indexOfSearch >= 0) {
        result = rule.substring(indexOfSearch + search.length);
        /**
         * WARNING!
         * Potential memory leak mitigation for substring operation due to V8 optimizations:
         * When extracting a substring with rule.substring(), there's a concern in some JS environments
         * that the resulting substring might retain a hidden reference to the entire original 'rule' string.
         * This could prevent the garbage collector (GC) from freeing the memory allocated for filter rules.
         * This hidden reference occurs because the substring might not create a new string but rather
         * a view into the original, keeping it in memory longer than necessary.
         * And we receive a memory leak here because we store parsed tags from first N lines of the filter rules
         * which have references to the original large string with filter rules.
         * To ensure that the original large string can be garbage collected, and only the necessary
         * substring is retained, we explicitly force a copy of the substring via split and join,
         * thereby breaking the direct reference to the original string and allowing the GC to free the memory
         * for filter rules when they are no longer in use.
         */
        result = result.split('').join('');
        break;
      }
    }

    if (tagName === 'Expires') {
      result = String(FilterParser.#parseExpiresStr(result));
    }

    if (tagName === 'TimeUpdated') {
      result = result || new Date().toISOString();
    }

    return result;
  }

  static #parseExpiresStr(str) {
    const regexp = /(\d+)\s+(day|hour)/;

    const parseRes = str.match(regexp);

    if (!parseRes) {
      const parsed = Number.parseInt(str, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    const [, num, period] = parseRes;

    let multiplier = 1;
    switch (period) {
      case 'day': {
        multiplier = 24 * 60 * 60;
        break;
      }
      case 'hour': {
        multiplier = 60 * 60;
        break;
      }
      default: {
        break;
      }
    }

    return Number(num) * multiplier;
  }
}
