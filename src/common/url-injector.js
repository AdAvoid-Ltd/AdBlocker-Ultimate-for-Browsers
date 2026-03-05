import {
  buildUrl,
  Endpoint,
  ExternalLinks,
} from '../background/services/ui/url-builder';

const EndpointKeyMap = {
  HOMEPAGE: Endpoint.Homepage,
  UPGRADE_PAGE: Endpoint.Upgrade,
  RATE_EXTENSION: Endpoint.RateExtension,
  PRIVACY_POLICY: Endpoint.Privacy,
  CONTACT: Endpoint.Contact,
  WINDOWS_APP: Endpoint.Windows,
  REPORT_PAGE: Endpoint.Report,
};

export function getUrlByKey(key) {
  if (ExternalLinks[key]) {
    return ExternalLinks[key];
  }

  if (EndpointKeyMap[key]) {
    return buildUrl(EndpointKeyMap[key]);
  }

  return null;
}
