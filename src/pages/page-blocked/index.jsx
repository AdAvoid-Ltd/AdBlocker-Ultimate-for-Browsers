import { useEffect, useState } from 'preact/hooks';
import { render } from 'preact';

import { Messenger } from '../services/messenger';
import { getMessage } from '../../common/i18n';

import '../common.pcss';
import './index.pcss';

function PageBlocked() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const blockedUrl = params.get('url') || '';
  const blockingRule = params.get('rule') || '';

  useEffect(() => {
    document.title = getMessage('page_blocked_title') || 'Page Blocked';
  }, []);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  const handleProceed = async () => {
    if (!blockedUrl) {
      return;
    }

    try {
      await Messenger.addUrlToTrusted(blockedUrl);
    } finally {
      // Button re-enables via state if we add loading state; for now no state
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <div class="shell">
        <div class="blocked-page">
          <div class="blocked-page__icon">
            <img src="/assets/icons/enabled-128.png" alt="" />
          </div>

          <h1 class="blocked-page__heading">{getMessage('page_blocked_heading')}</h1>

          <p class="blocked-page__url">{blockedUrl}</p>

          <p class="blocked-page__reason">{getMessage('page_blocked_reason')}</p>

          <code class="blocked-page__rule">{blockingRule}</code>

          <div class="blocked-page__actions">
            <button type="button" class="btn btn--border-blue" onClick={handleGoBack}>
              {getMessage('page_blocked_go_back')}
            </button>

            <ProceedButton blockedUrl={blockedUrl} onProceed={handleProceed} />
          </div>

          <p class="blocked-page__note">{getMessage('page_blocked_note')}</p>
        </div>
      </div>

      <div class="copyright">
        © 2016-{currentYear} AdAvoid Ltd.
      </div>
    </>
  );
}

function ProceedButton({ blockedUrl, onProceed }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!blockedUrl) {
      return;
    }

    setLoading(true);

    try {
      await onProceed();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" class="btn" onClick={handleClick} disabled={loading}>
      {getMessage('page_blocked_proceed')}
    </button>
  );
}

const root = document.getElementById('root');

if (root) {
  render(<PageBlocked />, root);
}
