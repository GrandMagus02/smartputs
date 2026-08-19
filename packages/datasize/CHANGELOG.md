# @smartput/datasize

## 0.2.0 (2026-08-19)

### Features

- **core:** fold adjacent descending quantities of a compound kind into a sum ([639025b](https://github.com/GrandMagus02/smartputs/commit/639025b621e6a97786a5cd1a275272fb5a7f1383))
- **core:** give formatted its own display policy, EngineOptions.display ([f0a0b62](https://github.com/GrandMagus02/smartputs/commit/f0a0b623e58cad44ff5d41569b718b9ad49623d8))

## 0.1.1 (2026-08-18)

Released to pick up a new version of a workspace dependency.

## 0.1.0 (2026-08-16)

### BREAKING CHANGES

- fold the language packages back into core and number ([9f9554e](https://github.com/GrandMagus02/smartputs/commit/9f9554ed1f2e590f651d68a032e39cf9d7ffdf57))
- **core:** remove lexicon, LocalePack and packs; vocabulary is the only home for words ([93be592](https://github.com/GrandMagus02/smartputs/commit/93be592b1af020f046b89acc1cc225ba04f0fbdd))
- split currency from rate, timezone from datetime, rename validate to shared ([68474d4](https://github.com/GrandMagus02/smartputs/commit/68474d44e47c8d2b6a7f4f1975945ccaf2d47e9d))

### Features

- **kinds:** English cue words for eleven built-in kinds ([9829be4](https://github.com/GrandMagus02/smartputs/commit/9829be4e180c10b06afa60384c27bb10595d28f9))
- fifteen languages across every kind package ([69f35de](https://github.com/GrandMagus02/smartputs/commit/69f35de15ea4c6f76611582498fb0dbd5df8ee61))
- **datasize:** Ukrainian vocabulary ([6d1b014](https://github.com/GrandMagus02/smartputs/commit/6d1b01421b2d6af66a943b3676443f05bda6b992))
- **datasize:** move English words into locale/en ([3ba4bc2](https://github.com/GrandMagus02/smartputs/commit/3ba4bc294a8653124c57a338c61064cbd04821b9))
- **mass:** move English words into locale/en and relocate typical ([06e137d](https://github.com/GrandMagus02/smartputs/commit/06e137db83b35bcb201ed865ce02bb71c9fb196e))
- **locale-en:** give English its own package and delete core/locale/en ([81b1b01](https://github.com/GrandMagus02/smartputs/commit/81b1b01b60fac0ba9b87813d39c9df344b685e69))
- **core:** Language, Vocabulary and composeLocale beside the existing lexicon ([bd232bd](https://github.com/GrandMagus02/smartputs/commit/bd232bd7e1ac39e739d720c0b8536a4a9840d6c3))
- implied unit count, date/time kinds, range packages ([3a53048](https://github.com/GrandMagus02/smartputs/commit/3a530486415aab4eb84b91e483fa86f074c798f4))
- **kinds:** roll units/validate/class to 11 kinds ([af9ed9e](https://github.com/GrandMagus02/smartputs/commit/af9ed9eb4f14de9526c31431dde8670694cd3b56))

### Bug Fixes

- **datarate:** give Ukrainian a symbol it can read back, at the cost of "/с" ([92f3746](https://github.com/GrandMagus02/smartputs/commit/92f37469d24683f1289dab8cfcc06b5b4459a8fa))
- **datasize:** correct Ukrainian SI prefix casing in the uk vocabulary ([7ff2b02](https://github.com/GrandMagus02/smartputs/commit/7ff2b020774fb28041a3c59d26a4e02d962c27cd))

### Performance

- **repo:** stop SmartputError linking decimal.js ([e285eff](https://github.com/GrandMagus02/smartputs/commit/e285eff9e2a6d2f73dfce1939cabf1c57615df1a))
- **repo:** stop vocabularies linking decimal.js ([ecbbac4](https://github.com/GrandMagus02/smartputs/commit/ecbbac4724aecde57b2eb6e393c21d0f810a79e4))
