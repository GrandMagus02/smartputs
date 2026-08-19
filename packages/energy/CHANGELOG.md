# @smartput/energy

## 0.2.0 (2026-08-19)

### Features

- **core:** a compound unit is a target and a result unit ([ae3ab96](https://github.com/GrandMagus02/smartputs/commit/ae3ab96eb1131caa9da23b05fa06f69937195cf0))
- **core:** give formatted its own display policy, EngineOptions.display ([f0a0b62](https://github.com/GrandMagus02/smartputs/commit/f0a0b623e58cad44ff5d41569b718b9ad49623d8))
- **core:** give display its own precision policy and let a unit declare tight spacing ([1aade59](https://github.com/GrandMagus02/smartputs/commit/1aade59dd8e7be57806105507b531e6afbbb8e24))

## 0.1.1 (2026-08-18)

Released to pick up a new version of a workspace dependency.

## 0.1.0 (2026-08-16)

### BREAKING CHANGES

- fold the language packages back into core and number ([9f9554e](https://github.com/GrandMagus02/smartputs/commit/9f9554ed1f2e590f651d68a032e39cf9d7ffdf57))
- **core:** remove lexicon, LocalePack and packs; vocabulary is the only home for words ([93be592](https://github.com/GrandMagus02/smartputs/commit/93be592b1af020f046b89acc1cc225ba04f0fbdd))

### Features

- **kinds:** English cue words for eleven built-in kinds ([9829be4](https://github.com/GrandMagus02/smartputs/commit/9829be4e180c10b06afa60384c27bb10595d28f9))
- fifteen languages across every kind package ([69f35de](https://github.com/GrandMagus02/smartputs/commit/69f35de15ea4c6f76611582498fb0dbd5df8ee61))
- **core:** lex the SI multiplication dot as multiplication ([98c3c5b](https://github.com/GrandMagus02/smartputs/commit/98c3c5b6b23eb01c57de45ff2004def840c3bda0))
- **energy:** Ukrainian vocabulary ([e4051fd](https://github.com/GrandMagus02/smartputs/commit/e4051fde87edc270dc3aa10aecc853fe3d0b94cd))
- **energy:** move English words into locale/en ([ef319f3](https://github.com/GrandMagus02/smartputs/commit/ef319f3c6d326f4da3ca2f535a4cc9155dc8d436))
- **mass:** move English words into locale/en and relocate typical ([06e137d](https://github.com/GrandMagus02/smartputs/commit/06e137db83b35bcb201ed865ce02bb71c9fb196e))
- **locale-en:** give English its own package and delete core/locale/en ([81b1b01](https://github.com/GrandMagus02/smartputs/commit/81b1b01b60fac0ba9b87813d39c9df344b685e69))
- **core:** Language, Vocabulary and composeLocale beside the existing lexicon ([bd232bd](https://github.com/GrandMagus02/smartputs/commit/bd232bd7e1ac39e739d720c0b8536a4a9840d6c3))
- implied unit count, date/time kinds, range packages ([3a53048](https://github.com/GrandMagus02/smartputs/commit/3a530486415aab4eb84b91e483fa86f074c798f4))
- add four ratio kinds, the off operator, and one edit distance ([53b35c8](https://github.com/GrandMagus02/smartputs/commit/53b35c8fe55bf91bd7ff8ace52550162335d3c36))

### Performance

- **repo:** stop SmartputError linking decimal.js ([e285eff](https://github.com/GrandMagus02/smartputs/commit/e285eff9e2a6d2f73dfce1939cabf1c57615df1a))
- **repo:** stop vocabularies linking decimal.js ([ecbbac4](https://github.com/GrandMagus02/smartputs/commit/ecbbac4724aecde57b2eb6e393c21d0f810a79e4))
