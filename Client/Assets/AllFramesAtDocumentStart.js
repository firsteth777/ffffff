!function(e){var t={};function n(r){if(t[r])return t[r].exports;var o=t[r]={i:r,l:!1,exports:{}};return e[r].call(o.exports,o,o.exports,n),o.l=!0,o.exports}n.m=e,n.c=t,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)n.d(r,o,function(t){return e[t]}.bind(null,o));return r},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=2)}([,,function(e,t,n){n(3),n(4),e.exports=n(5)},function(e,t,n){"use strict";window.__firefox__||Object.defineProperty(window,"__firefox__",{enumerable:!1,configurable:!1,writable:!1,value:{userScripts:{},includeOnce:function(e,t){return!!__firefox__.userScripts[e]||(__firefox__.userScripts[e]=!0,"function"==typeof t&&t(),!1)}}})},function(e,t,n){"use strict";webkit.messageHandlers.adsMediaReporting&&function(){function e(e){webkit.messageHandlers.adsMediaReporting.postMessage(e)}function t(){e(!1)}function n(){e(!0)}new MutationObserver((function(e){e.forEach((function(e){e.addedNodes.forEach((function(e){!function(e){"HTMLVideoElement"==e.constructor.name&&document.querySelectorAll("video").forEach((function(e){e.addEventListener("pause",t,!1),e.addEventListener("playing",n,!1)}))}(e)}))}))})).observe(document,{subtree:!0,childList:!0})}()},function(e,t,n){"use strict";["https://www.twitch.tv","https://m.twitch.tv","https://player.twitch.tv","https://www.youtube.com","https://m.youtube.com","https://vimeo.com"].includes(document.location.origin)&&webkit.messageHandlers.rewardsReporting&&function(){function e(e,t,n,r){webkit.messageHandlers.rewardsReporting.postMessage({method:void 0===e?"GET":e,url:t,data:void 0===n?null:n,referrerUrl:void 0===r?null:r})}var t=XMLHttpRequest.prototype.open,n=XMLHttpRequest.prototype.send,r=window.fetch,o=navigator.sendBeacon,i=Object.getOwnPropertyDescriptor(Image.prototype,"src");XMLHttpRequest.prototype.open=function(n,r){var o=function(){e(this._method,null===this.responseURL?this._url:this.responseURL,this._data,this._ref)};return this._method=n,this._url=r,this.addEventListener("load",o,!0),this.addEventListener("error",o,!0),t.apply(this,arguments)},XMLHttpRequest.prototype.send=function(e){return this._ref=null,this._data=e,e instanceof Document&&(this._ref=e.referrer,this._data=null),n.apply(this,arguments)},window.fetch=function(t,n){var o=arguments,i=t instanceof Request?t.url:t;return new Promise((function(t,s){r.apply(this,o).then((function(r){e(n.method,i,n.body,n.referrer),t(r)})).catch((function(t){e(n.method,i,n.body,n.referrer),s(t)}))}))},navigator.sendBeacon=function(t,n){return e("POST",t,n),o.apply(this,arguments)},delete Image.prototype.src,Object.defineProperty(Image.prototype,"src",{get:function(){return i.get.call(this)},set:function(t){var n=function(){e("GET",this.src)};this.addEventListener("load",n,!0),this.addEventListener("error",n,!0),i.set.call(this,t)}})}()}]);