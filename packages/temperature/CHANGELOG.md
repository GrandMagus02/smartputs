# @smartput/temperature

## 0.1.1 (2026-08-18)

Released to pick up a new version of a workspace dependency.

## 0.1.0 (2026-08-16)

### BREAKING CHANGES

- fold the language packages back into core and number ([9f9554e](https://github.com/GrandMagus02/smartputs/commit/9f9554ed1f2e590f651d68a032e39cf9d7ffdf57))
- split currency from rate, timezone from datetime, rename validate to shared ([68474d4](https://github.com/GrandMagus02/smartputs/commit/68474d44e47c8d2b6a7f4f1975945ccaf2d47e9d))

### Features

- **kinds:** English cue words for eleven built-in kinds ([9829be4](https://github.com/GrandMagus02/smartputs/commit/9829be4e180c10b06afa60384c27bb10595d28f9))
- fifteen languages across every kind package ([69f35de](https://github.com/GrandMagus02/smartputs/commit/69f35de15ea4c6f76611582498fb0dbd5df8ee61))
- **temperature:** Ukrainian vocabulary ([01a46fd](https://github.com/GrandMagus02/smartputs/commit/01a46fd2dfd24cfeeaf76a7b1abad2799a2d2d35))
- **temperature:** move English words into locale/en ([eba47a7](https://github.com/GrandMagus02/smartputs/commit/eba47a79a4fc080598b590ba0d5c4d05a167ab21))
- **mass:** move English words into locale/en and relocate typical ([06e137d](https://github.com/GrandMagus02/smartputs/commit/06e137db83b35bcb201ed865ce02bb71c9fb196e))
- **locale-en:** give English its own package and delete core/locale/en ([81b1b01](https://github.com/GrandMagus02/smartputs/commit/81b1b01b60fac0ba9b87813d39c9df344b685e69))
- **core:** Language, Vocabulary and composeLocale beside the existing lexicon ([bd232bd](https://github.com/GrandMagus02/smartputs/commit/bd232bd7e1ac39e739d720c0b8536a4a9840d6c3))
- implied unit count, date/time kinds, range packages ([3a53048](https://github.com/GrandMagus02/smartputs/commit/3a530486415aab4eb84b91e483fa86f074c798f4))
- **kinds:** roll units/validate/class to 11 kinds ([af9ed9e](https://github.com/GrandMagus02/smartputs/commit/af9ed9eb4f14de9526c31431dde8670694cd3b56))

### Bug Fixes

- repair confirmed review findings across the validate path ([e1ee753](https://github.com/GrandMagus02/smartputs/commit/e1ee753578cd77ffa10af5920a7d307b5fa368ba))

### Performance

- **repo:** stop SmartputError linking decimal.js ([e285eff](https://github.com/GrandMagus02/smartputs/commit/e285eff9e2a6d2f73dfce1939cabf1c57615df1a))
- **repo:** stop vocabularies linking decimal.js ([ecbbac4](https://github.com/GrandMagus02/smartputs/commit/ecbbac4724aecde57b2eb6e393c21d0f810a79e4))
