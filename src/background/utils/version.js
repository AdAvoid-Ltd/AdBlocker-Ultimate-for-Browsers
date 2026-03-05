/**
 * Helper class for work with semver.
 *
 * Parsed semver string saves in {@link data} property.
 * We save first {@link Version.MAX_LENGTH} parts of parsed string.
 * If there are less than {@link Version.MAX_LENGTH} parts in the version, the missing ones are filled with zeros
 * For example, entry string `1.1` will be parsed as `[1, 1, 0, 0]`.
 */
export class Version {
  static MAX_LENGTH = 4;

  // splitted semver
  data = [];

  constructor(version) {
    const parts = String(version || '').split('.', Version.MAX_LENGTH);

    for (let i = 0; i < Version.MAX_LENGTH; i += 1) {
      if (parts[i] === '') {
        throw new Error(`Found empty part in string '${version}'`);
      }

      const part = parts[i] || '0';

      if (part.length > 1 && part.startsWith('0')) {
        throw new Error(`Can not parse ${version}. Leading zeros are not allowed in the version parts`);
      }

      if (Number.isNaN(Number.parseInt(part, 10))) {
        throw new Error(`Can not parse '${version}' string`);
      }

      this.data[i] = Math.max(Number(part), 0);
    }
  }

  compare(version) {
    for (let i = 0; i < Version.MAX_LENGTH; i += 1) {
      const leftPart = this?.data?.[i];
      const rightPart = version?.data?.[i];

      if (typeof leftPart !== 'number' || typeof rightPart !== 'number') {
        throw new Error('Can not compare versions');
      }

      if (leftPart > rightPart) {
        return 1;
      }
      if (leftPart < rightPart) {
        return -1;
      }
    }
    return 0;
  }
}
