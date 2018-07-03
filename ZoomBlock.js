/*

  Zoom Block - A browser extension that disables zooming.
  Copyright (C) 2018 Wesley Warnell
  https://github.com/warnellw/Zoom-Block

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

'use strict';

(api => {
  class ZoomBlock {
    constructor (api) {
      this.browser = api

      this.enabledTabs = new Set()

      this.popup = this.browser.runtime.getURL('popup.html')

      this.images = new Map()
        .set('red', {
          '16': this.browser.runtime.getURL('icons/red16.png'),
          '24': this.browser.runtime.getURL('icons/red24.png'),
          '32': this.browser.runtime.getURL('icons/red32.png')
        })
        .set('green', {
          '16': this.browser.runtime.getURL('icons/green16.png'),
          '24': this.browser.runtime.getURL('icons/green24.png'),
          '32': this.browser.runtime.getURL('icons/green32.png')
        })
        .set('gray', {
          '16': this.browser.runtime.getURL('icons/gray16.png'),
          '24': this.browser.runtime.getURL('icons/gray24.png'),
          '32': this.browser.runtime.getURL('icons/gray32.png')
        })
    }

    addListeners () {
      this.browser.browserAction.onClicked.addListener(Tab =>
        this.iconClick(Tab)
      )
      this.browser.runtime.onInstalled.addListener(() => this.init())
      this.browser.runtime.onStartup.addListener(() => this.init())
      this.browser.tabs.onRemoved.addListener(tabId =>
        this.removeEnabled(tabId)
      )
      this.browser.tabs.onUpdated.addListener((tabId, changeInfo) =>
        this.tabUpdated(tabId, changeInfo)
      )
    }

    getEnabled (tabId) {
      return this.enabledTabs.has(tabId)
    }

    setEnabled (tabId) {
      this.enabledTabs.add(tabId)
    }

    removeEnabled (tabId) {
      this.enabledTabs.delete(tabId)
    }

    setPopup (tabId, error) {
      this.browser.browserAction.setPopup({
        tabId, popup: error ? this.popup : ''
      })
    }

    zoomConstructor (mode) {
      return {
        mode: mode === false ? 'disabled' : 'automatic',
        scope: 'per-tab'
      }
    }

    init () {
      this.browser.tabs.query({}, results => {
        results.forEach(result => this.store(result))
      })
    }

    store (Tab) {
      this.setZoomSettings(Tab.id, false, error => {
        if (error) this.updateIcon(Tab.id)
      })
    }

    updateIcon (tabId, enabled) {
      this.browser.browserAction.setIcon({
        path: this.images.get(
          enabled === false ? 'red'
            : enabled === true ? 'green'
              : 'gray'
        ),
        tabId
      })
    }

    setZoomSettings (tabId, zoomSetting, callback) {
      this.browser.tabs.setZoomSettings(
        tabId,
        this.zoomConstructor(zoomSetting),
        () => {
          const error = !!this.browser.runtime.lastError
          this.setPopup(tabId, error)
          callback(error)
        }
      )
    }

    iconClick (Tab) {
      const enabled = !this.getEnabled(Tab.id)
      this.setZoomSettings(Tab.id, enabled, error => {
        if (enabled && !error) {
          this.setEnabled(Tab.id)
        } else if (!error) {
          this.removeEnabled(Tab.id)
        }
        this.updateIcon(Tab.id, error ? undefined : enabled)
      })
    }

    tabUpdated (tabId, changeInfo) {
      if (changeInfo.status !== 'loading') return
      const enabled = this.getEnabled(tabId)
      this.setZoomSettings(tabId, enabled, error => {
        // https://bugs.chromium.org/p/chromium/issues/detail?id=30113
        if (error || enabled) {
          this.updateIcon(tabId, error ? undefined : true)
        }
      })
    }
  }

  new ZoomBlock(api).addListeners()
})(window.browser || window.chrome)
