// Copyright 2022 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

"use strict";

window.braveFarble = (args) => {
  // A value between 0.99 and 1 to fudge the audio data
  // A value between 0.99 to 1 means the values in the destination will 
  // always be within the expected range of -1 and 1.
  // This small decrease should not affect affect legitimite users of this api.
  // But will affect fingerprinters by introducing a small random change.
  const fudgeFactor = args['fudgeFactor']
  // Fake data that is to be used to construct fake plugins
  const fakePluginData = args['fakePluginData']
  // A value representing a fake voice name that will be used to add a fake voice
  const fakeVoiceName = args['fakeVoiceName']
  // This value is used to get a random index between 0 and voices.length
  // It's important to have a value between 0 - 1 in order to be within the 
  // array bounds
  const randomVoiceIndexScale = args['randomVoiceIndexScale']

  const farbledChannels = new WeakMap()
  const braveNacl = window.nacl
  delete window.nacl

  const farbleArrayData = (destination) => {
    // Let's fudge the data by our fudge factor.
    for (const index in destination) {
      destination[index] = destination[index] * fudgeFactor
    }
  }

  // Convert an unsinged byte (Uint8) to a hex character
  // Unsigned bytes must be between 0 and 255
  const byteToHex = (unsignedByte) => {
    // convert the possibly signed byte (-128 to 127) to an unsigned byte (0 to 255).
    // if you know, that you only deal with unsigned bytes (Uint8Array), you can omit this line
    // const unsignedByte = byte & 0xff

    // If the number can be represented with only 4 bits (0-15),
    // the hexadecimal representation of this number is only one char (0-9, a-f).
    if (unsignedByte < 16) {
      return '0' + unsignedByte.toString(16)
    } else {
      return unsignedByte.toString(16)
    }
  }

  // Convert an array of unsigned bytes (Uint8Array) to a hex string.
  // Each value in the array must be between 0 and 255,
  // resulting in hex values between 0 to f (i.e. 0 to 15)
  const toHexString = (unsignedBytes) => {
    return Array.from(unsignedBytes)
      .map(byte => byteToHex(byte))
      .join('')
  }

  // Hash an array
  const hashArray = (a) => {
    const byteArray = new Uint8Array(a.buffer)
    const hexArray = braveNacl.hash(byteArray)
    return toHexString(hexArray)
  }

  // 1. Farble `getChannelData`
  // This will also result in a farbled `copyFromChannel`
  const getChannelData = window.AudioBuffer.prototype.getChannelData
  window.AudioBuffer.prototype.getChannelData = function () {
    const channelData = Reflect.apply(getChannelData, this, arguments)
    let hashes = farbledChannels.get(channelData)

    // First let's check if we already farbled this set
    if (hashes !== undefined) {
      // We had this data set farbled already.
      // Lets see if it changed it's shape since then.
      const hash = hashArray(channelData)

      if (hashes.has(hash)) {
        // We already farbled this version of the channel data
        // Let's not farble it again
        return channelData
      }
    } else {
      // If we dont have any hashes of farbled data at all for this
      // channel, then we trivially haven't hashed this channel data yet.
      hashes = new Set()
      farbledChannels.set(channelData, hashes)
    }

    // Farble the array and store the hash of this
    // so that we don't farble the same data again.
    farbleArrayData(channelData)
    const hash = hashArray(channelData)
    hashes.add(hash)

    return channelData
  }

  // 2. Farble "destination" methods
  const structuresToFarble = [
    [window.AnalyserNode, 'getFloatFrequencyData'],
    [window.AnalyserNode, 'getByteFrequencyData'],
    [window.AnalyserNode, 'getByteTimeDomainData'],
    [window.AnalyserNode, 'getFloatTimeDomainData']
  ]

  for (const [structure, methodName] of structuresToFarble) {
    const origImplementation = structure.prototype[methodName]
    structure.prototype[methodName] = function () {
      Reflect.apply(origImplementation, this, arguments)
      farbleArrayData(arguments[0])
    }
  }

  // 3. Farble plugin data
  // Function that create a fake mime-type based on the given fake data
  const makeFakeMimeType = (fakeData) => {
    return Object.create(window.MimeType.prototype, {
      suffixes: {
        get: function () {
          return fakeData.suffixes
        }
      },
      type: {
        get: function () {
          return fakeData.type
        }
      },
      description: {
        get: function () {
          return fakeData.description
        }
      }
    })
  }

  // Create a fake plugin given the plugin data
  const makeFakePlugin = (pluginData) => {
    const newPlugin = Object.create(window.Plugin.prototype, {
      description: {
        get: function () {
          return pluginData.description
        }
      },
      name: {
        get: function () {
          return pluginData.name
        }
      },
      filename: {
        get: function () {
          return pluginData.filename
        }
      },
      length: {
        get: function () {
          return pluginData.mimeTypes.length
        }
      }
    })

    // Create mime-types and link them to the new plugin
    for (const [index, mimeType] of pluginData.mimeTypes.entries()) {
      const newMimeType = makeFakeMimeType(mimeType)

      newPlugin[index] = newMimeType
      newPlugin[newMimeType.type] = newMimeType

      Reflect.defineProperty(newMimeType, 'enabledPlugin', {
        get: function () {
          return newPlugin
        }
      })
    }

    // Fix .item() function to return the correct item
    newPlugin.item = function (index) {
      return newPlugin[index]
    }

    return newPlugin
  }

  if (window.navigator.plugins !== undefined) {
    // We need the original length so we can reference it (as we will change it)
    const plugins = window.navigator.plugins
    const originalPluginsLength = plugins.length
    const originalItemFunction = plugins.item

    // Adds a fake plugin for the given index on fakePluginData
    const addPluginAtIndex = (newPlugin, index) => {
      const pluginPosition = originalPluginsLength + index
      window.navigator.plugins[pluginPosition] = newPlugin
      window.navigator.plugins[newPlugin.name] = newPlugin
    }

    for (const [index, pluginData] of fakePluginData.entries()) {
      const newPlugin = makeFakePlugin(pluginData)
      addPluginAtIndex(newPlugin, index)
    }

    // Adjust the length of the original plugin array
    Reflect.defineProperty(window.navigator.plugins, 'length', {
      get: function () {
        return originalPluginsLength + fakePluginData.length
      }
    })

    // Patch `PluginArray.item(index)` function to return the correct item 
    // otherwise it returns `undefined`
    window.PluginArray.prototype.item = function (index) {
      if (index < originalPluginsLength) {
        return Reflect.apply(originalItemFunction, plugins, arguments)
      } else {
        return plugins[index]
      }
    }
  }

  // 4. Farble speech synthesizer
  const makeFakeVoiceFromVoice = (voice) => {
    const voicePrototype = Object.getPrototypeOf(voice)

    const newVoice = Object.create(voicePrototype, {
      name: {
        get: function () {
          return fakeVoiceName
        }
      },
      voiceURI: {
        get: function () {
          return voice.voiceURI
        }
      },
      lang: {
        get: function () {
          return voice.lang
        }
      },
      localService: {
        get: function () {
          return voice.localService
        }
      },
      default: {
        get: function () {
          return false
        }
      }
    })

    return newVoice
  }

  let originalVoice
  let fakeVoice
  let passedFakeVoice

  // We need to override the voice property to allow our fake voice to work
  const descriptor = Reflect.getOwnPropertyDescriptor(SpeechSynthesisUtterance.prototype, 'voice')
  Reflect.defineProperty(SpeechSynthesisUtterance.prototype, 'voice', {
    get: function () {
      if (!passedFakeVoice) {
        // We didn't set a fake voice
        return Reflect.apply(descriptor.get, this, arguments)
      } else {
        // We set a fake voice, return that instead
        return passedFakeVoice
      }
    },
    set: function (passedVoice) {
      if (passedVoice === fakeVoice && originalVoice !== undefined) {
        // If we passed a fake voice, ignore it. We need to use the real voice
        // The fake voice will not work.
        passedFakeVoice = passedVoice
        Reflect.apply(descriptor.set, this, [originalVoice])
      } else {
        // Otherwise, if we set a real voice, use a real voice instead.
        passedFakeVoice = undefined
        Reflect.apply(descriptor.set, this, arguments)
      }
    }
  })

  // Patch get voices to return an extra fake voice
  const getVoices = window.speechSynthesis.getVoices
  const getVoicesPrototype = Object.getPrototypeOf(window.speechSynthesis)
  getVoicesPrototype.getVoices = function () {
    const voices = Reflect.apply(getVoices, this, arguments)

    if (fakeVoice === undefined) {
      const randomVoiceIndex = Math.round(randomVoiceIndexScale * voices.length)
      originalVoice = voices[randomVoiceIndex]
      fakeVoice = makeFakeVoiceFromVoice(originalVoice)

      if (fakeVoice !== undefined) {
        voices.push(fakeVoice)
      }
    } else {
      voices.push(fakeVoice)
    }
    return voices
  }
}

// Invoke window.braveFarble then delete the function
