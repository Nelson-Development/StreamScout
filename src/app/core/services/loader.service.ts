import { Injectable } from '@angular/core';

declare const SSLoader: { show(text?: string): void; hide(): void; done(text?: string): void } | undefined;

@Injectable({ providedIn: 'root' })
export class LoaderService {
  show(text?: string) { if (typeof SSLoader !== 'undefined') SSLoader.show(text); }
  hide()              { if (typeof SSLoader !== 'undefined') SSLoader.hide(); }
  done(text?: string) { if (typeof SSLoader !== 'undefined') SSLoader.done(text); }
}
