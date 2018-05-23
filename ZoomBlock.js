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
          '19': this.browser.runtime.getURL('icons/red19.png'),
          '38': this.browser.runtime.getURL('icons/red38.png')
        })
        .set('green', {
          '19': this.browser.runtime.getURL('icons/green19.png'),
          '38': this.browser.runtime.getURL('icons/green38.png')
        })
        .set('black', {
          '19': this.browser.runtime.getURL('icons/black19.png'),
          '38': this.browser.runtime.getURL('icons/black38.png')
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

    zoomConstructor (mode) {
      return {
        mode: mode === false ? 'disabled' : 'automatic',
        scope: 'per-tab'
      }
    }

    setPopup (tabId, error) {
      this.browser.browserAction.setPopup({
        tabId: tabId, popup: error ? this.popup : ''
      })
    }

    updateIcon (tabId, enabled) {
      let color =
        enabled === false ? 'red' : enabled === true ? 'green' : 'black'
      this.browser.browserAction.setIcon({
        path: this.images.get(color),
        tabId: tabId
      })
    }

    init () {
      this.browser.tabs.query({}, results => {
        results.forEach(result => this.store(result))
      })
    }

    store (Tab) {
      this.setZoomSettings(Tab.id, false, error => {
        if (error) this.updateIcon(Tab.id, undefined)
      })
    }

    iconClick (Tab) {
      let enabled = !this.getEnabled(Tab.id)
      this.setZoomSettings(Tab.id, enabled, error => {
        if (enabled && !error) {
          this.setEnabled(Tab.id)
        } else if (!error) {
          this.removeEnabled(Tab.id)
        }
        this.updateIcon(Tab.id, error ? undefined : !!enabled)
      })
    }

    setZoomSettings (tabId, zoomSetting, callback) {
      this.browser.tabs.setZoomSettings(
        tabId,
        this.zoomConstructor(zoomSetting),
        () => {
          this.setPopup(tabId, !!this.browser.runtime.lastError)
          callback(this.browser.runtime.lastError || undefined)
        }
      )
    }

    tabUpdated (tabId, changeInfo) {
      if (changeInfo.status !== 'loading') return
      let enabled = this.getEnabled(tabId)
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
