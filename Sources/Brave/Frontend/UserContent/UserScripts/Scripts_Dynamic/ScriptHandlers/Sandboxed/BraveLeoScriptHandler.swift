// Copyright 2020 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import Foundation
import WebKit
import os.log

class BraveLeoScriptHandler: NSObject, TabContentScript {
  fileprivate weak var tab: Tab?

  init(tab: Tab) {
    self.tab = tab
    super.init()
  }
  
  static let getMainArticle = "getMainArticle\(uniqueID)"

  static let scriptName = "BraveLeoScript"
  static let scriptId = UUID().uuidString
  static let messageHandlerName = "\(scriptName)_\(messageUUID)"
  static let scriptSandbox: WKContentWorld = .defaultClient
  static let userScript: WKUserScript? = {
    guard var script = loadUserScript(named: scriptName) else {
      return nil
    }
    
    return WKUserScript(source: secureScript(handlerNamesMap: ["$<message_handler>": messageHandlerName,
                                                               "$<getMainArticle>": getMainArticle],
                                             securityToken: scriptId,
                                             script: script),
                        injectionTime: .atDocumentEnd,
                        forMainFrameOnly: true,
                        in: scriptSandbox)
  }()

  func userContentController(_ userContentController: WKUserContentController, didReceiveScriptMessage message: WKScriptMessage, replyHandler: (Any?, String?) -> Void) {
    defer { replyHandler(nil, nil) }
    
    if !verifyMessage(message: message) {
      assertionFailure("Missing required security token.")
      return
    }
  }
}

extension BraveLeoScriptHandler {

  static func getMainArticle(webView: WKWebView, completion: @escaping (String?) -> Void) {
    webView.evaluateSafeJavaScript(functionName: "window.__firefox__.\(getMainArticle)",
                                        args: [Self.scriptId],
                                        contentWorld: Self.scriptSandbox,
                                        asFunction: true) { value, error in
      if let error = error {
        Logger.module.error("Error Retrieving Main Article From Page: \(error.localizedDescription)")
      }
      
      completion(value as? String)
    }
  }
}