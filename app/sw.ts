/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "@serwist/sw";

declare global {
  interface WorkerGlobalScope {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __SW_MANIFEST: any;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
