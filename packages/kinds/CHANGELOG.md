# @smartput/kinds

## 0.2.0 (2026-08-18)

### Features

- **core:** context-aware completion, and the count query ([77b4c88](https://github.com/GrandMagus02/smartputs/commit/77b4c8880bf42e88031b67dd65ea00381dcc9718))

## 0.1.0 (2026-08-16)

### BREAKING CHANGES

- fold the language packages back into core and number ([9f9554e](https://github.com/GrandMagus02/smartputs/commit/9f9554ed1f2e590f651d68a032e39cf9d7ffdf57))
- **core:** remove lexicon, LocalePack and packs; vocabulary is the only home for words ([93be592](https://github.com/GrandMagus02/smartputs/commit/93be592b1af020f046b89acc1cc225ba04f0fbdd))
- split currency from rate, timezone from datetime, rename validate to shared ([68474d4](https://github.com/GrandMagus02/smartputs/commit/68474d44e47c8d2b6a7f4f1975945ccaf2d47e9d))
- **core:** widen QuantitySnapshot.value to string|number ([f65c84d](https://github.com/GrandMagus02/smartputs/commit/f65c84d41f615cca7cc96eac676f4610be64625b))

### Features

- **kinds:** English cue words for eleven built-in kinds ([9829be4](https://github.com/GrandMagus02/smartputs/commit/9829be4e180c10b06afa60384c27bb10595d28f9))
- fifteen languages across every kind package ([69f35de](https://github.com/GrandMagus02/smartputs/commit/69f35de15ea4c6f76611582498fb0dbd5df8ee61))
- **core:** lex the SI multiplication dot as multiplication ([98c3c5b](https://github.com/GrandMagus02/smartputs/commit/98c3c5b6b23eb01c57de45ff2004def840c3bda0))
- **core:** assertLocaleContract — the four checks M5 promised ([3215be7](https://github.com/GrandMagus02/smartputs/commit/3215be7ae1b7d2fa56509009482ccc045b778795))
- **temperature:** move English words into locale/en ([eba47a7](https://github.com/GrandMagus02/smartputs/commit/eba47a79a4fc080598b590ba0d5c4d05a167ab21))
- **volume:** move English words into locale/en ([09a94d3](https://github.com/GrandMagus02/smartputs/commit/09a94d3fbcfe6e458d0c14e12611648d938aeda0))
- **tempo:** move English words into locale/en ([fc94bec](https://github.com/GrandMagus02/smartputs/commit/fc94bec6fb1de9a12dc3b76eb9dcd064601d15bc))
- **measure:** move English words into locale/en ([a4a769f](https://github.com/GrandMagus02/smartputs/commit/a4a769f0429cf8d2c1043d0713e4219702f17775))
- **number:** move English words into locale/en ([7e3e50c](https://github.com/GrandMagus02/smartputs/commit/7e3e50c6bf2e31763752c38e896b088e2e097292))
- **energy:** move English words into locale/en ([ef319f3](https://github.com/GrandMagus02/smartputs/commit/ef319f3c6d326f4da3ca2f535a4cc9155dc8d436))
- **angle:** move English words into locale/en ([1d6886d](https://github.com/GrandMagus02/smartputs/commit/1d6886de4e67945da4c038bb3ac285658ba29cf8))
- **duration:** move English words into locale/en ([880cf81](https://github.com/GrandMagus02/smartputs/commit/880cf81939d400a9b39a55e03d3b3fbfa8b20678))
- **mass:** move English words into locale/en and relocate typical ([06e137d](https://github.com/GrandMagus02/smartputs/commit/06e137db83b35bcb201ed865ce02bb71c9fb196e))
- **locale-en:** give English its own package and delete core/locale/en ([81b1b01](https://github.com/GrandMagus02/smartputs/commit/81b1b01b60fac0ba9b87813d39c9df344b685e69))
- **core:** build the alias index from vocabularies, with a bridge for lexicon ([d95aff5](https://github.com/GrandMagus02/smartputs/commit/d95aff5cf5bc1d0fb68f897769812491e81a20ca))
- **core:** Language, Vocabulary and composeLocale beside the existing lexicon ([bd232bd](https://github.com/GrandMagus02/smartputs/commit/bd232bd7e1ac39e739d720c0b8536a4a9840d6c3))
- add four ratio kinds, the off operator, and one edit distance ([53b35c8](https://github.com/GrandMagus02/smartputs/commit/53b35c8fe55bf91bd7ff8ace52550162335d3c36))
- **kinds:** add validate/class barrels, contract, budgets ([ebba781](https://github.com/GrandMagus02/smartputs/commit/ebba781a68a523aeb2207858ae9ff372f28ce317))

### Bug Fixes

- **core:** complete() offered the language it read, not the one it writes ([f3e4d86](https://github.com/GrandMagus02/smartputs/commit/f3e4d8659ef568006c6d06f006e506b19f961af5))
- repair confirmed review findings across the validate path ([e1ee753](https://github.com/GrandMagus02/smartputs/commit/e1ee753578cd77ffa10af5920a7d307b5fa368ba))

### Performance

- **repo:** stop SmartputError linking decimal.js ([e285eff](https://github.com/GrandMagus02/smartputs/commit/e285eff9e2a6d2f73dfce1939cabf1c57615df1a))
- **repo:** stop vocabularies linking decimal.js ([ecbbac4](https://github.com/GrandMagus02/smartputs/commit/ecbbac4724aecde57b2eb6e393c21d0f810a79e4))
