# @smartput/number

## 0.2.0 (2026-08-19)

### Features

- **core:** give formatted its own display policy, EngineOptions.display ([f0a0b62](https://github.com/GrandMagus02/smartputs/commit/f0a0b623e58cad44ff5d41569b718b9ad49623d8))

## 0.1.1 (2026-08-18)

Released to pick up a new version of a workspace dependency.

## 0.1.0 (2026-08-16)

### BREAKING CHANGES

- fold the language packages back into core and number ([9f9554e](https://github.com/GrandMagus02/smartputs/commit/9f9554ed1f2e590f651d68a032e39cf9d7ffdf57))
- split currency from rate, timezone from datetime, rename validate to shared ([68474d4](https://github.com/GrandMagus02/smartputs/commit/68474d44e47c8d2b6a7f4f1975945ccaf2d47e9d))

### Features

- fifteen languages across every kind package ([69f35de](https://github.com/GrandMagus02/smartputs/commit/69f35de15ea4c6f76611582498fb0dbd5df8ee61))
- **number:** Ukrainian vocabulary ([320e1e3](https://github.com/GrandMagus02/smartputs/commit/320e1e3a6dd5d49ad78c87c3e4f5d7eda7d191f5))
- **number:** move English words into locale/en ([7e3e50c](https://github.com/GrandMagus02/smartputs/commit/7e3e50c6bf2e31763752c38e896b088e2e097292))
- **locale-en:** give English its own package and delete core/locale/en ([81b1b01](https://github.com/GrandMagus02/smartputs/commit/81b1b01b60fac0ba9b87813d39c9df344b685e69))
- **core:** Language, Vocabulary and composeLocale beside the existing lexicon ([bd232bd](https://github.com/GrandMagus02/smartputs/commit/bd232bd7e1ac39e739d720c0b8536a4a9840d6c3))
- add four ratio kinds, the off operator, and one edit distance ([53b35c8](https://github.com/GrandMagus02/smartputs/commit/53b35c8fe55bf91bd7ff8ace52550162335d3c36))
- **kinds:** roll units/validate/class to 11 kinds ([af9ed9e](https://github.com/GrandMagus02/smartputs/commit/af9ed9eb4f14de9526c31431dde8670694cd3b56))
- **number:** expose the number vocabulary, with hundred in it ([15004c7](https://github.com/GrandMagus02/smartputs/commit/15004c740dd11e434575b9bf97c9dafe0824d0a9))

### Bug Fixes

- repair confirmed review findings across the validate path ([e1ee753](https://github.com/GrandMagus02/smartputs/commit/e1ee753578cd77ffa10af5920a7d307b5fa368ba))

### Performance

- **repo:** stop SmartputError linking decimal.js ([e285eff](https://github.com/GrandMagus02/smartputs/commit/e285eff9e2a6d2f73dfce1939cabf1c57615df1a))
- **repo:** stop vocabularies linking decimal.js ([ecbbac4](https://github.com/GrandMagus02/smartputs/commit/ecbbac4724aecde57b2eb6e393c21d0f810a79e4))
