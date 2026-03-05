import { trustedDomainsModel } from '../models';

export class DocumentBlockService {
  static TRUSTED_TTL_MS = 10 * 1000; // 10 seconds

  static async init() {
    try {
      const storageData = await trustedDomainsModel.read();
      if (typeof storageData === 'string') {
        trustedDomainsModel.setCache(JSON.parse(storageData));
      } else {
        await trustedDomainsModel.setData([]);
      }
    } catch (e) {
      await trustedDomainsModel.setData([]);
    }
  }

  static async getTrustedDomains() {
    const now = Date.now();

    // remove expired
    const data = trustedDomainsModel.getData().filter(({ expires }) => now < expires);
    await trustedDomainsModel.setData(data);

    return data.map(({ domain }) => domain);
  }

  static async storeTrustedDomain(input) {
    const now = Date.now();

    // remove expired and duplicates
    const data = trustedDomainsModel.getData().filter(({ expires, domain }) => now < expires && domain !== input);

    data.push({ domain: input, expires: DocumentBlockService.TRUSTED_TTL_MS + now });

    await trustedDomainsModel.setData(data);
  }

  static async setTrustedDomain(url) {
    const { hostname } = new URL(url);

    DocumentBlockService.storeTrustedDomain(hostname);
  }
}
