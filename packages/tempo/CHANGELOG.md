# @smartput/tempo

## 0.1.0 (2026-08-16)

### BREAKING CHANGES

- fold the language packages back into core and number ([9f9554e](https://github.com/GrandMagus02/smartputs/commit/9f9554ed1f2e590f651d68a032e39cf9d7ffdf57))
- **core:** remove lexicon, LocalePack and packs; vocabulary is the only home for words ([93be592](https://github.com/GrandMagus02/smartputs/commit/93be592b1af020f046b89acc1cc225ba04f0fbdd))

### Features

- fifteen languages across every kind package ([69f35de](https://github.com/GrandMagus02/smartputs/commit/69f35de15ea4c6f76611582498fb0dbd5df8ee61))
- **tempo:** Ukrainian vocabulary ([a466ea0](https://github.com/GrandMagus02/smartputs/commit/a466ea0ecddc72b6bf9504905c60e6139b9f5e01))
- **tempo:** move English words into locale/en ([fc94bec](https://github.com/GrandMagus02/smartputs/commit/fc94bec6fb1de9a12dc3b76eb9dcd064601d15bc))
- **mass:** move English words into locale/en and relocate typical ([06e137d](https://github.com/GrandMagus02/smartputs/commit/06e137db83b35bcb201ed865ce02bb71c9fb196e))
- **locale-en:** give English its own package and delete core/locale/en ([81b1b01](https://github.com/GrandMagus02/smartputs/commit/81b1b01b60fac0ba9b87813d39c9df344b685e69))
- **core:** Language, Vocabulary and composeLocale beside the existing lexicon ([bd232bd](https://github.com/GrandMagus02/smartputs/commit/bd232bd7e1ac39e739d720c0b8536a4a9840d6c3))
- implied unit count, date/time kinds, range packages ([3a53048](https://github.com/GrandMagus02/smartputs/commit/3a530486415aab4eb84b91e483fa86f074c798f4))
- add four ratio kinds, the off operator, and one edit distance ([53b35c8](https://github.com/GrandMagus02/smartputs/commit/53b35c8fe55bf91bd7ff8ace52550162335d3c36))

### Bug Fixes

- **tempo:** make bpm's Ukrainian symbol one the lexer can read back ([e2a7915](https://github.com/GrandMagus02/smartputs/commit/e2a7915a88ba9e68ad5efcc2679062e9904ec6a5))
- **tempo:** add the locative-singular alias hz was printing but not reading ([c8a4973](https://github.com/GrandMagus02/smartputs/commit/c8a49730993e19647ed8d28287b9dfdde98d64ed))
- **core:** lex a group separator that normalize folded to a plain space ([f7fbbdd](https://github.com/GrandMagus02/smartputs/commit/f7fbbdda9b2c68436f7f93e113cdee4d59240cec))

### Performance

- **repo:** stop SmartputError linking decimal.js ([e285eff](https://github.com/GrandMagus02/smartputs/commit/e285eff9e2a6d2f73dfce1939cabf1c57615df1a))
- **repo:** stop vocabularies linking decimal.js ([ecbbac4](https://github.com/GrandMagus02/smartputs/commit/ecbbac4724aecde57b2eb6e393c21d0f810a79e4))
