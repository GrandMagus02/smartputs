# @smartput/duration

## 0.3.0 (2026-08-19)

### Features

- **core:** fold adjacent descending quantities of a compound kind into a sum ([639025b](https://github.com/GrandMagus02/smartputs/commit/639025b621e6a97786a5cd1a275272fb5a7f1383))
- **core:** give formatted its own display policy, EngineOptions.display ([f0a0b62](https://github.com/GrandMagus02/smartputs/commit/f0a0b623e58cad44ff5d41569b718b9ad49623d8))

## 0.2.0 (2026-08-18)

### Features

- **core:** context-aware completion, and the count query ([77b4c88](https://github.com/GrandMagus02/smartputs/commit/77b4c8880bf42e88031b67dd65ea00381dcc9718))

## 0.1.0 (2026-08-16)

### BREAKING CHANGES

- fold the language packages back into core and number ([9f9554e](https://github.com/GrandMagus02/smartputs/commit/9f9554ed1f2e590f651d68a032e39cf9d7ffdf57))
- **core:** remove lexicon, LocalePack and packs; vocabulary is the only home for words ([93be592](https://github.com/GrandMagus02/smartputs/commit/93be592b1af020f046b89acc1cc225ba04f0fbdd))
- split currency from rate, timezone from datetime, rename validate to shared ([68474d4](https://github.com/GrandMagus02/smartputs/commit/68474d44e47c8d2b6a7f4f1975945ccaf2d47e9d))

### Features

- **kinds:** English cue words for eleven built-in kinds ([9829be4](https://github.com/GrandMagus02/smartputs/commit/9829be4e180c10b06afa60384c27bb10595d28f9))
- fifteen languages across every kind package ([69f35de](https://github.com/GrandMagus02/smartputs/commit/69f35de15ea4c6f76611582498fb0dbd5df8ee61))
- **duration:** Ukrainian vocabulary ([12bd89f](https://github.com/GrandMagus02/smartputs/commit/12bd89fecc9a6af3ce9a40dab0b974c7bd81a670))
- **duration:** move English words into locale/en ([880cf81](https://github.com/GrandMagus02/smartputs/commit/880cf81939d400a9b39a55e03d3b3fbfa8b20678))
- **locale-en:** give English its own package and delete core/locale/en ([81b1b01](https://github.com/GrandMagus02/smartputs/commit/81b1b01b60fac0ba9b87813d39c9df344b685e69))
- **core:** Language, Vocabulary and composeLocale beside the existing lexicon ([bd232bd](https://github.com/GrandMagus02/smartputs/commit/bd232bd7e1ac39e739d720c0b8536a4a9840d6c3))
- implied unit count, date/time kinds, range packages ([3a53048](https://github.com/GrandMagus02/smartputs/commit/3a530486415aab4eb84b91e483fa86f074c798f4))
- **kinds:** roll units/validate/class to 11 kinds ([af9ed9e](https://github.com/GrandMagus02/smartputs/commit/af9ed9eb4f14de9526c31431dde8670694cd3b56))

### Performance

- **repo:** stop SmartputError linking decimal.js ([e285eff](https://github.com/GrandMagus02/smartputs/commit/e285eff9e2a6d2f73dfce1939cabf1c57615df1a))
- **repo:** stop vocabularies linking decimal.js ([ecbbac4](https://github.com/GrandMagus02/smartputs/commit/ecbbac4724aecde57b2eb6e393c21d0f810a79e4))
