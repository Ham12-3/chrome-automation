import { browser } from 'wxt/browser';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    console.log('[Content] Chrome Automation content script loaded');

    // Listen for commands from the service worker
    browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
      handleMessage(msg as Record<string, unknown>).then(sendResponse).catch((err) => {
        sendResponse({ error: err instanceof Error ? err.message : String(err) });
      });
      return true; // Keep the message channel open for async response
    });
  },
});

// ─── Message Handlers ──────────────────────────────────────────────────────

async function handleMessage(msg: Record<string, unknown>): Promise<unknown> {
  switch (msg.type) {
    case 'CLICK':
      return handleClick(msg.selector as string);

    case 'CLICK_TEXT':
      return handleClickText(msg.text as string, Boolean(msg.exact));

    case 'CLICK_COORDINATES':
      return handleClickCoordinates(msg.x as number, msg.y as number);

    case 'DOUBLE_CLICK':
      return handleDoubleClick(msg.selector as string);

    case 'HOVER':
      return handleHover(msg.selector as string);

    case 'TYPE':
      return handleType(msg.selector as string, msg.text as string, Boolean(msg.clear));

    case 'TYPE_FOCUSED':
      return handleTypeFocused(msg.text as string);

    case 'PRESS_KEY':
      return handlePressKey(msg.key as string, msg.selector as string | undefined);

    case 'SCROLL':
      return handleScroll(msg.selector as string | undefined, msg.x as number | undefined, msg.y as number | undefined);

    case 'SELECT_OPTION':
      return handleSelectOption(msg.selector as string, msg.value as string);

    case 'UPLOAD_FILE':
      return handleUploadFile(msg.selector as string, msg.fileName as string, msg.mimeType as string, msg.dataBase64 as string);

    case 'WAIT_FOR_SELECTOR':
      return handleWaitForSelector(msg.selector as string, msg.timeoutMs as number | undefined);

    case 'WAIT_FOR_TEXT':
      return handleWaitForText(msg.text as string, msg.timeoutMs as number | undefined);

    case 'GET_DOM':
      return handleGetDOM(msg.selector as string | undefined);

    case 'GET_PAGE_TEXT':
      return handleGetPageText();

    case 'GET_INTERACTIVE_ELEMENTS':
      return handleGetInteractiveElements();

    case 'EXECUTE_JS':
      return handleExecuteJS(msg.code as string);

    case 'GO_BACK':
      history.back();
      return { navigated: 'back' };

    case 'GO_FORWARD':
      history.forward();
      return { navigated: 'forward' };

    default:
      throw new Error(`Unknown content command: ${msg.type}`);
  }
}

// ─── Click Simulation ──────────────────────────────────────────────────────

function handleClick(selector: string): { selector: string; clicked: boolean; tagName: string } {
  const el = findElement(selector);
  if (!el) {
    throw new Error(`Element not found: ${selector}`);
  }

  if (!(el instanceof HTMLElement || el instanceof SVGElement)) {
    throw new Error(`Element is not interactable: ${selector}`);
  }

  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error(`Element is not visible: ${selector}`);
  }

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Dispatch a proper sequence of mouse events
  const opts = { bubbles: true, cancelable: true, composed: true, clientX: centerX, clientY: centerY };

  el.dispatchEvent(new PointerEvent('pointerover', opts));
  el.dispatchEvent(new PointerEvent('pointerdown', opts));
  el.dispatchEvent(new MouseEvent('mouseover', opts));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  if (el instanceof HTMLElement) {
    el.focus();
  }
  el.dispatchEvent(new PointerEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));

  if (el instanceof HTMLElement && typeof el.click === 'function') {
    el.click();
  }

  return { selector, clicked: true, tagName: el.tagName.toLowerCase() };
}

function handleClickText(text: string, exact = false): { text: string; clicked: boolean; selector: string } {
  const normalized = text.trim().toLowerCase();
  const candidates = Array.from(document.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="link"], [tabindex]'));
  const match = candidates.find((el) => {
    const value = elementText(el).toLowerCase();
    return exact ? value === normalized : value.includes(normalized);
  });
  if (!match) {
    throw new Error(`No clickable element found with text: ${text}`);
  }
  const selector = buildSelector(match);
  handleClick(selector);
  return { text, clicked: true, selector };
}

function handleClickCoordinates(x: number, y: number): { x: number; y: number; clicked: boolean } {
  const el = document.elementFromPoint(x, y);
  if (!el) throw new Error(`No element at coordinates ${x}, ${y}`);
  const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
  el.dispatchEvent(new PointerEvent('pointerdown', opts));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
  if (el instanceof HTMLElement) el.click();
  return { x, y, clicked: true };
}

function handleDoubleClick(selector: string): { selector: string; doubleClicked: boolean } {
  const el = findElement(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  handleClick(selector);
  handleClick(selector);
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, composed: true }));
  return { selector, doubleClicked: true };
}

function handleHover(selector: string): { selector: string; hovered: boolean } {
  const el = findElement(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  const rect = el.getBoundingClientRect();
  const opts = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
  el.dispatchEvent(new PointerEvent('pointerover', opts));
  el.dispatchEvent(new MouseEvent('mouseover', opts));
  el.dispatchEvent(new MouseEvent('mousemove', opts));
  return { selector, hovered: true };
}

// ─── Type Simulation ──────────────────────────────────────────────────────

function handleType(selector: string, text: string, clear = false): { selector: string; text: string; clear: boolean } {
  const el = findElement(selector);
  if (!el) {
    throw new Error(`Element not found: ${selector}`);
  }

  // Focus the element
  if (el instanceof HTMLElement) {
    el.focus();
  }

  // For input/textarea elements, set value and dispatch events
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (clear) {
      setNativeValue(el, '');
    }
    for (const char of text) {
      dispatchKeyboard(el, 'keydown', char);
      dispatchKeyboard(el, 'keypress', char);
      setNativeValue(el, el.value + char);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: char, inputType: 'insertText' }));
      dispatchKeyboard(el, 'keyup', char);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el instanceof HTMLElement && el.isContentEditable) {
    if (clear) {
      el.textContent = '';
    }
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: text, inputType: 'insertText' }));
  } else {
    throw new Error(`Element is not editable: ${selector}`);
  }

  return { selector, text, clear };
}

function handleTypeFocused(text: string): { text: string; typed: boolean } {
  const active = document.activeElement;
  if (!active) throw new Error('No focused element');
  const selector = buildSelector(active);
  handleType(selector, text, false);
  return { text, typed: true };
}

function handlePressKey(key: string, selector?: string): { key: string; selector?: string; pressed: boolean } {
  const el = selector ? findElement(selector) : document.activeElement;
  if (!el) {
    throw new Error(selector ? `Element not found: ${selector}` : 'No active element');
  }

  const target = el as Element;
  dispatchKeyboard(target, 'keydown', key);
  dispatchKeyboard(target, 'keypress', key);

  if (key === 'Enter' && target instanceof HTMLInputElement) {
    target.form?.requestSubmit();
  }

  dispatchKeyboard(target, 'keyup', key);
  return { key, selector, pressed: true };
}

function handleScroll(selector?: string, x = 0, y = 600): { selector?: string; x: number; y: number; scrolled: boolean } {
  const target = selector ? findElement(selector) : document.scrollingElement;
  if (!target) {
    throw new Error(selector ? `Element not found: ${selector}` : 'No scroll target');
  }

  if ('scrollBy' in target) {
    (target as Element).scrollBy({ left: x, top: y, behavior: 'smooth' });
  } else {
    window.scrollBy({ left: x, top: y, behavior: 'smooth' });
  }

  return { selector, x, y, scrolled: true };
}

function handleSelectOption(selector: string, value: string): { selector: string; value: string; selected: boolean } {
  const el = findElement(selector);
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error(`Element is not a select: ${selector}`);
  }
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { selector, value, selected: true };
}

function handleUploadFile(selector: string, fileName: string, mimeType: string, dataBase64: string): { selector: string; fileName: string; uploaded: boolean } {
  const el = findElement(selector);
  if (!(el instanceof HTMLInputElement) || el.type !== 'file') {
    throw new Error(`Element is not a file input: ${selector}`);
  }
  const bytes = Uint8Array.from(atob(dataBase64), (char) => char.charCodeAt(0));
  const file = new File([bytes], fileName, { type: mimeType });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  el.files = dataTransfer.files;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { selector, fileName, uploaded: true };
}

function handleWaitForSelector(selector: string, timeoutMs = 10_000): Promise<{ selector: string; found: boolean; tagName: string }> {
  const existing = findElement(selector);
  if (existing) {
    return Promise.resolve({ selector, found: true, tagName: existing.tagName.toLowerCase() });
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for selector: ${selector}`));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const el = findElement(selector);
      if (!el) return;
      clearTimeout(timer);
      observer.disconnect();
      resolve({ selector, found: true, tagName: el.tagName.toLowerCase() });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

function handleWaitForText(text: string, timeoutMs = 10_000): Promise<{ text: string; found: boolean }> {
  if ((document.body?.innerText ?? '').includes(text)) {
    return Promise.resolve({ text, found: true });
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for text: ${text}`));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      if (!(document.body?.innerText ?? '').includes(text)) return;
      clearTimeout(timer);
      observer.disconnect();
      resolve({ text, found: true });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
}

// ─── DOM Extraction ────────────────────────────────────────────────────────

function handleGetDOM(selector?: string): { html: string; selector?: string } {
  if (selector) {
    const el = findElement(selector);
    if (!el) {
      throw new Error(`Element not found: ${selector}`);
    }
    return { html: el.outerHTML, selector };
  }
  return { html: document.body?.outerHTML ?? document.documentElement.outerHTML };
}

function handleGetPageText(): { text: string; title: string; url: string } {
  return {
    text: document.body?.innerText ?? '',
    title: document.title,
    url: location.href,
  };
}

function handleGetInteractiveElements(): { elements: Array<Record<string, unknown>> } {
  const elements = Array.from(document.querySelectorAll([
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]',
    '[role="textbox"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(','))).slice(0, 300);

  return {
    elements: elements.map((el) => {
      const rect = el.getBoundingClientRect();
      const input = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
      return {
        selector: buildSelector(el),
        tagName: el.tagName.toLowerCase(),
        text: elementText(el).slice(0, 300),
        role: el.getAttribute('role') ?? undefined,
        label: getLabel(el),
        name: el.getAttribute('name') ?? undefined,
        type: el.getAttribute('type') ?? undefined,
        href: el instanceof HTMLAnchorElement ? el.href : undefined,
        value: input?.value,
        placeholder: input?.placeholder,
        disabled: 'disabled' in el && Boolean((el as { disabled?: boolean }).disabled),
        visible: rect.width > 0 && rect.height > 0,
        bounds: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    }),
  };
}

function findElement(selector: string): Element | null {
  return document.querySelector(selector);
}

function elementText(el: Element): string {
  if (el instanceof HTMLInputElement) {
    return el.value || el.placeholder || el.getAttribute('aria-label') || '';
  }
  return [
    el.textContent,
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
  ].filter(Boolean).join(' ').trim();
}

function getLabel(el: Element): string | undefined {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ') || undefined;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const label = el.labels?.[0]?.textContent?.trim();
    if (label) return label;
  }
  return undefined;
}

function buildSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.documentElement && parts.length < 5) {
    let part = current.tagName.toLowerCase();
    const name = current.getAttribute('name');
    if (name) {
      part += `[name="${CSS.escape(name)}"]`;
    } else {
      const parent = current.parentElement;
      if (parent) {
        const index = Array.from(parent.children).indexOf(current) + 1;
        part += `:nth-child(${index})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function dispatchKeyboard(target: Element, type: 'keydown' | 'keypress' | 'keyup', key: string): void {
  target.dispatchEvent(new KeyboardEvent(type, {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    bubbles: true,
    cancelable: true,
    composed: true,
  }));
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(el, value);
}

// ─── JS Execution ──────────────────────────────────────────────────────────

function handleExecuteJS(code: string): { result: unknown } {
  try {
    // Execute in the page context
    const result = eval(code);
    return { result };
  } catch (err) {
    throw new Error(`JS execution error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
