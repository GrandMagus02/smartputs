# @smartput/datetime

## 0.1.0 (2026-08-16)

### BREAKING CHANGES

- delete @smartput/country, @smartput/city and @smartput/zip ([b4e654e](https://github.com/GrandMagus02/smartputs/commit/b4e654e1c257e23cc57b3dc241b426fd6a4a88b0))
- fold the language packages back into core and number ([9f9554e](https://github.com/GrandMagus02/smartputs/commit/9f9554ed1f2e590f651d68a032e39cf9d7ffdf57))
- split currency from rate, timezone from datetime, rename validate to shared ([68474d4](https://github.com/GrandMagus02/smartputs/commit/68474d44e47c8d2b6a7f4f1975945ccaf2d47e9d))

### Features

- fifteen languages across every kind package ([69f35de](https://github.com/GrandMagus02/smartputs/commit/69f35de15ea4c6f76611582498fb0dbd5df8ee61))
- **datetime,rate:** the Ukrainian vocabularies ([ca78828](https://github.com/GrandMagus02/smartputs/commit/ca78828b67a57aa73ec0c9ada98639d6ce92a202))
- **country:** move English country names into locale/en ([f6c0345](https://github.com/GrandMagus02/smartputs/commit/f6c0345493eac7338508e1c7de4761ce2c908bcb))
- **datetime:** move English words into locale/en ([ee7dc9a](https://github.com/GrandMagus02/smartputs/commit/ee7dc9a51f37c56671b0ea148d0673c9f78153c8))
- **mass:** move English words into locale/en and relocate typical ([06e137d](https://github.com/GrandMagus02/smartputs/commit/06e137db83b35bcb201ed865ce02bb71c9fb196e))
- **locale-en:** give English its own package and delete core/locale/en ([81b1b01](https://github.com/GrandMagus02/smartputs/commit/81b1b01b60fac0ba9b87813d39c9df344b685e69))
- **core:** build the alias index from vocabularies, with a bridge for lexicon ([d95aff5](https://github.com/GrandMagus02/smartputs/commit/d95aff5cf5bc1d0fb68f897769812491e81a20ca))
- **core:** Language, Vocabulary and composeLocale beside the existing lexicon ([bd232bd](https://github.com/GrandMagus02/smartputs/commit/bd232bd7e1ac39e739d720c0b8536a4a9840d6c3))
- implied unit count, date/time kinds, range packages ([3a53048](https://github.com/GrandMagus02/smartputs/commit/3a530486415aab4eb84b91e483fa86f074c798f4))
- **geo:** M6.3 — postal codes, providers, and readings the solver ranks ([3ecec9b](https://github.com/GrandMagus02/smartputs/commit/3ecec9bfe35626357e57c87f8b2c512d930c9577))
- **geo:** @smartput/geo M6.1 — countries, distance, datetime/rates bridges ([57fea20](https://github.com/GrandMagus02/smartputs/commit/57fea20dd3ac943b38abd22502c477fe5ea98002))
- **datetime:** M4 — @smartput/datetime ([5a43097](https://github.com/GrandMagus02/smartputs/commit/5a430977921bfcc167b774263c109156a02a5761))

### Performance

- **repo:** stop SmartputError linking decimal.js ([e285eff](https://github.com/GrandMagus02/smartputs/commit/e285eff9e2a6d2f73dfce1939cabf1c57615df1a))
- **repo:** stop vocabularies linking decimal.js ([ecbbac4](https://github.com/GrandMagus02/smartputs/commit/ecbbac4724aecde57b2eb6e393c21d0f810a79e4))
