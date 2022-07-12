// Copyright 2020 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import Shared
import Storage
import UIKit
import WebKit
import XCGLogger
import BraveShared

private let log = Logger.browserLogger

// MARK: - OpenSearch

public struct OpenSearchReference: Codable {
  let reference: String
  let title: String?

  private enum CodingKeys: String, CodingKey {
    case reference = "href"
    case title = "title"
  }
}

// MARK: - OpenSearch Browser Extension

extension BrowserViewController {

  /// Adding Toolbar button over the keyboard for adding Open Search Engine
  /// - Parameter webView: webview triggered open seach engine
  @discardableResult
  func evaluateWebsiteSupportOpenSearchEngine(_ webView: WKWebView) -> Bool {
    if let tab = tabManager[webView],
      let openSearchMetaData = tab.pageMetadata?.search,
      let url = webView.url,
      url.isSecureWebPage() {
      return updateAddOpenSearchEngine(
        webView, referenceObject: OpenSearchReference(reference: openSearchMetaData.href, title: openSearchMetaData.title))
    }

    return false
  }

  @discardableResult
  private func updateAddOpenSearchEngine(_ webView: WKWebView, referenceObject: OpenSearchReference) -> Bool {
    var supportsAutoAdd = true

    // Add Reference Object as Open Search Engine
    openSearchEngine = referenceObject

    // Open Search guidelines requires Title to be same as Short Name but it is not enforced,
    // thus in case of google.com the title is 'Google Search' and Shortname is 'Google'
    // We are checking referenceURL match to determine searchEngine is added or not
    // In addition we are also checking if there is another engine with same name

    let searchEngineExists = profile.searchEngines.orderedEngines.contains(where: {
      let nameExists = $0.shortName.lowercased() == referenceObject.title?.lowercased() ?? ""

      if let referenceURL = $0.referenceURL {
        return referenceObject.reference.contains(referenceURL) || nameExists
      }

      return nameExists
    })

    if searchEngineExists {
      self.customSearchEngineButton.action = .disabled
      supportsAutoAdd = false
    } else {
      self.customSearchEngineButton.action = .enabled
      supportsAutoAdd = true
    }

    /*
         This is how we access hidden views in the WKContentView
         Using the public headers we can find the keyboard accessoryView which is not usually available.
         Specific values here are from the WKContentView headers.
         https://github.com/JaviSoto/iOS9-Runtime-Headers/blob/master/Frameworks/WebKit.framework/WKContentView.h
         */
    guard let webContentView = UIView.findSubViewWithFirstResponder(webView) else {
      /*
             In some cases the URL bar can trigger the keyboard notification. In that case the webview isnt the first responder
             and a search button should not be added.
             */
      return supportsAutoAdd
    }

    if UIDevice.isIpad {
      if customSearchBarButtonItemGroup == nil {
        customSearchBarButtonItemGroup = UIBarButtonItemGroup(
          barButtonItems: [UIBarButtonItem(customView: customSearchEngineButton)], representativeItem: nil)
      } else {
        webContentView.inputAssistantItem.trailingBarButtonGroups.removeAll(
          where: { $0.barButtonItems.contains(where: { $0.customView != nil }) })
      }

      if let barButtonItemGroup = customSearchBarButtonItemGroup {
        webContentView.inputAssistantItem.trailingBarButtonGroups.append(barButtonItemGroup)
      }
    } else {
      let argumentNextItem: [Any] = ["_n", "extI", "tem"]
      let argumentView: [Any] = ["v", "ie", "w"]

      let valueKeyNextItem = argumentNextItem.compactMap { $0 as? String }.joined()
      let valueKeyView = argumentView.compactMap { $0 as? String }.joined()

      guard let input = webContentView.perform(#selector(getter:UIResponder.inputAccessoryView)),
        let inputView = input.takeUnretainedValue() as? UIInputView,
        let nextButton = inputView.value(forKey: valueKeyNextItem) as? UIBarButtonItem,
        let nextButtonView = nextButton.value(forKey: valueKeyView) as? UIView
      else {
        return supportsAutoAdd
      }

      inputView.addSubview(customSearchEngineButton)

      customSearchEngineButton.snp.remakeConstraints { make in
        make.leading.equalTo(nextButtonView.snp.trailing).offset(20)
        make.width.equalTo(inputView.snp.height)
        make.top.equalTo(nextButtonView.snp.top)
        make.height.equalTo(inputView.snp.height)
      }
    }

    return supportsAutoAdd
  }

  @objc func addCustomSearchEngineForFocusedElement() {
    guard var reference = openSearchEngine?.reference,
      let title = openSearchEngine?.title,
      var url = URL(string: reference)
    else {
      let alert = ThirdPartySearchAlerts.failedToAddThirdPartySearch()
      present(alert, animated: true, completion: nil)
      return
    }

    guard let scheme = tabManager.selectedTab?.webView?.url?.scheme,
      let host = tabManager.selectedTab?.webView?.url?.host
    else {
      log.error("Selected Tab doesn't have URL")
      return
    }

    while reference.hasPrefix("/") {
      reference.remove(at: reference.startIndex)
    }

    let constructedReferenceURLString = "\(scheme)://\(host)/\(reference)"

    if url.host == nil, let constructedReferenceURL = URL(string: constructedReferenceURLString) {
      url = constructedReferenceURL
    }

    downloadOpenSearchXML(url, reference: reference, title: title, icon: tabManager.selectedTab?.displayFavicon)
  }

  func downloadOpenSearchXML(_ url: URL, reference: String, title: String, icon: Favicon?) {
    customSearchEngineButton.action = .loading

    var searchEngineIcon = FaviconFetcher.defaultFaviconImage
    if let favicon = tabManager.selectedTab?.displayFavicon?.image {
      searchEngineIcon = favicon
      createSearchEngine(url, reference: reference, icon: favicon)
    } else {
      createSearchEngine(url, reference: reference, icon: searchEngineIcon)
    }
  }

  private func createSearchEngine(_ url: URL, reference: String, icon: UIImage) {
    NetworkManager().downloadResource(with: url) { result in
      switch result {
      case .success(let response):
        guard let openSearchEngine = OpenSearchParser(pluginMode: true).parse(
          response.data,
          referenceURL: reference,
          image: icon,
          isCustomEngine: true) else {
          return
        }

        self.addSearchEngine(openSearchEngine)
        
      case .failure(let error):
        log.error(error)
      }
    }
  }

  private func addSearchEngine(_ engine: OpenSearchEngine) {
    let alert = ThirdPartySearchAlerts.addThirdPartySearchEngine(engine) { alertAction in
      if alertAction.style == .cancel {
        return
      }

      do {
        try self.profile.searchEngines.addSearchEngine(engine)
        self.view.endEditing(true)

        let toast = SimpleToast()
        toast.showAlertWithText(Strings.CustomSearchEngine.thirdPartySearchEngineAddedToastTitle, bottomContainer: self.webViewContainer)

        self.customSearchEngineButton.action = .disabled
      } catch {
        let alert = ThirdPartySearchAlerts.failedToAddThirdPartySearch()
        self.present(alert, animated: true) {
          self.customSearchEngineButton.action = .enabled
        }
      }
    }

    self.present(alert, animated: true, completion: {})
  }
}

// MARK: - KeyboardHelperDelegate

extension BrowserViewController: KeyboardHelperDelegate {
  public func keyboardHelper(_ keyboardHelper: KeyboardHelper, keyboardWillShowWithState state: KeyboardState) {
    keyboardState = state
    updateViewConstraints()

    UIViewPropertyAnimator(duration: state.animationDuration, curve: state.animationCurve) {
      self.alertStackView.layoutIfNeeded()
    }
    .startAnimation()

    guard let webView = tabManager.selectedTab?.webView else { return }

    self.evaluateWebsiteSupportOpenSearchEngine(webView)
  }

  public func keyboardHelper(_ keyboardHelper: KeyboardHelper, keyboardWillHideWithState state: KeyboardState) {
    keyboardState = nil
    updateViewConstraints()

    customSearchBarButtonItemGroup?.barButtonItems.removeAll()
    customSearchBarButtonItemGroup = nil

    if customSearchEngineButton.superview != nil {
      customSearchEngineButton.removeFromSuperview()
    }

    UIViewPropertyAnimator(duration: state.animationDuration, curve: state.animationCurve) {
      self.alertStackView.layoutIfNeeded()
    }
    .startAnimation()
  }
}
