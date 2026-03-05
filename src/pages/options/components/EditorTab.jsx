import { useRef, useCallback } from 'preact/hooks';
import { useComputed, useSignal } from '@preact/signals';
import { saveAs } from 'file-saver';
import { getMessage } from '../../../common/i18n';
import { IconUpload, IconDownload } from '../../../resources/svg-icons';
import { activeTabIndex, debouncedSaveEditors } from '../store';

/** Must match CSS line-height and padding-top for .editor__gutter / .editor__textarea */
const LINE_HEIGHT_PX = 16;
const PADDING_TOP = 4;

function countLines(text) {
  if (!text) return 1;

  let count = 1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') count++;
  }

  return count;
}

function getLineFromPosition(text, pos) {
  let line = 1;

  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }

  return line;
}

export function EditorTab({ index, headingKey, exportFileName, contentSignal }) {
  const className = useComputed(() =>
    `tabs__content ${activeTabIndex.value === index ? 'active' : ''}`,
  );

  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const highlightRef = useRef(null);
  const focusedRef = useRef(false);

  // Only recompute line count (not full text split) on content change.
  const lineCount = useComputed(() => countLines(contentSignal?.value));
  // Only rebuild gutter string when line count actually changes.
  const prevLineCount = useSignal(0);
  const gutterCache = useSignal('1');

  const gutterText = useComputed(() => {
    const count = lineCount.value;

    if (count !== prevLineCount.value) {
      prevLineCount.value = count;
      gutterCache.value = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    }

    return gutterCache.value;
  });

  const updateHighlight = useCallback(() => {
    const ta = textareaRef.current;
    const el = highlightRef.current;

    if (!ta || !el) {
      return;
    }

    if (!focusedRef.current || ta.selectionStart !== ta.selectionEnd) {
      el.style.top = '-999px';

      return;
    }

    const line = getLineFromPosition(ta.value, ta.selectionStart);

    el.style.top = `${PADDING_TOP + (line - 1) * LINE_HEIGHT_PX - ta.scrollTop}px`;
  }, []);

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;

    if (!ta) {
      return
    };

    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }

    updateHighlight();
  }, [updateHighlight]);

  const handleInput = (e) => {
    if (contentSignal) {
      contentSignal.value = e.target.value;
    }

    debouncedSaveEditors();
    updateHighlight();
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];

    if (!file || !contentSignal) {
      return;
    }

    const fr = new FileReader();

    fr.onload = () => {
      contentSignal.value = fr.result;

      debouncedSaveEditors();
    };

    fr.readAsText(file);

    e.target.value = '';
  };

  const handleExport = () => {
    const text = contentSignal?.value ?? '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });

    saveAs(blob, exportFileName);
  };

  const handleFocus = useCallback(() => {
    focusedRef.current = true;

    updateHighlight();
  }, [updateHighlight]);

  const handleBlur = useCallback(() => {
    focusedRef.current = false;

    if (highlightRef.current) {
      highlightRef.current.style.top = '-999px';
    }
  }, []);

  return (
    <div class={className}>
      <div class="editor">
        <h2 class="editor__heading">{getMessage(headingKey)}</h2>

        <div class="editor__body">
          <div class="editor__active-line" ref={highlightRef} style="top:-999px" />

          <div class="editor__gutter" ref={gutterRef} aria-hidden="true">
            {gutterText}
          </div>

          <div class="editor__content">
            <textarea
              ref={textareaRef}
              class="editor__textarea"
              value={contentSignal?.value ?? ''}
              onInput={handleInput}
              onScroll={handleScroll}
              onClick={updateHighlight}
              onKeyUp={updateHighlight}
              onFocus={handleFocus}
              onBlur={handleBlur}
              spellcheck={false}
            />
          </div>
        </div>

        <div class="editor__actions">
          <div class="btn btn--file">
            <input type="file" accept=".txt" onChange={handleImport} />

            <IconUpload class="icon" />

            <span>{getMessage('options_userfilter_import')}</span>
          </div>

          <div class="btn btn--border-blue" onClick={handleExport}>
            <IconDownload class="icon" />

            <span>{getMessage('options_userfilter_export')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
