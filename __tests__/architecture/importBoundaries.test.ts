/**
 * The import boundaries CLAUDE.md section 4 sets, checked on every file.
 *
 * - axios only inside `src/core/http` (a type-only import elsewhere is erased
 *   at build time and allowed — `BaseApiService` names a request config);
 * - AsyncStorage only inside `src/core/storage`;
 * - NetInfo only inside `src/shared/services/device` (the one device service);
 * - the image picker only inside `ApiImageService` (Phase 4B, 24/11/2026: the
 *   one route to the camera and the photo library is `ImageService`);
 * - UI code — a feature's screens and components, the shared components and the
 *   navigators — never reaches the service registry, a permissions library,
 *   NetInfo, AsyncStorage, axios or an icon library. It calls a hook. The one
 *   exception is `shared/components/Icon.tsx`, which is the icon library's
 *   wrapper and the reason nothing else needs it.
 *
 * Written on 21/10/2026, when the first run found the Add / Edit Address
 * screen calling `getService` itself (moved into `useSavedAddressEditor`).
 * Every suite passed with that break in place: a rule nobody runs is a rule
 * nobody keeps. Plain file reads, no mocks — this test cannot be fooled by a
 * renderer.
 *
 * Widened the same day, after a review found what it could not see: a shared
 * component reading the registry (`ServiceCategoryField`, moved into
 * `useServiceCategories`), and every way of naming a module other than
 * `import … from` — a re-export, an import for its side effects, a dynamic
 * `import()`, and the registry reached by a relative path. A module is named
 * at run time by any of those, so all of them count; only the type-only forms,
 * which the compiler erases, do not. The matcher is tested on its own first
 * (`runtimeModules`), so a rule that passes is known to be looking.
 *
 * ⚠️ No Node types. This file is in the same tsc program as the app, so a
 * `/// <reference types="node" />` here — or an `import fs from 'fs'`, which
 * needs one — puts `process`, `Buffer` and `__dirname` in scope for every app
 * file, where they type-check and then fail on Hermes. The two Node modules
 * used are loaded through `jest.requireActual` and typed by the few functions
 * this file calls; `__dirname` is declared for this module alone.
 */

/** The parts of Node's `fs` this file uses, and nothing else. */
interface DirectoryEntry {
  name: string;
  isDirectory(): boolean;
}
interface FileSystem {
  readdirSync(dir: string, options: { withFileTypes: true }): DirectoryEntry[];
  readFileSync(file: string, encoding: 'utf8'): string;
}

/** The parts of Node's `path` this file uses. */
interface PathModule {
  sep: string;
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  resolve(...parts: string[]): string;
}

// Jest's module wrapper provides it at run time. Declared here, in module
// scope (see the `export` below), so it exists for this file and no other.
declare const __dirname: string;

const fs = jest.requireActual<FileSystem>('fs');
const path = jest.requireActual<PathModule>('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry): string[] => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return filesUnder(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const ALL = filesUnder(SRC).map(file => ({
  file: path.relative(ROOT, file).split(path.sep).join('/'),
  text: fs.readFileSync(file, 'utf8'),
}));

/*
  `import … from` and `export … from`, at the start of a line. The clause
  between the keyword and `from` is bindings only — names, braces, commas, `*`,
  `as`, `type` — and may not run into another statement, so a declaration
  such as `export function` or `export const` is never read as one.
*/
const FROM_STATEMENT =
  /^[ \t]*(?:import|export)\s+((?:(?!\b(?:import|export)\b)[\w$\s{},*])*?)\s*\bfrom\s*['"]([^'"]+)['"]/gm;
/* `import 'mod'` — loaded for its side effects, with nothing bound. */
const SIDE_EFFECT_IMPORT = /^[ \t]*import\s*['"]([^'"]+)['"]/gm;
/*
  `import('mod')` and `require('mod')`, anywhere in the text — except
  `typeof import('mod')`, a type query the compiler erases.
*/
const CALLED = /(?<!\btypeof\s+)\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/*
  A clause the compiler erases: `type X`, `type { X }`, `type * as X`, or braces
  holding nothing but `type`-marked names. `type` alone is a default binding
  named "type", which is a value.
*/
const TYPE_ONLY_CLAUSE =
  /^(?:type\s+[\w${*][\s\S]*|\{\s*type\s+[\w$]+(?:\s+as\s+[\w$]+)?(?:\s*,\s*type\s+[\w$]+(?:\s+as\s+[\w$]+)?)*\s*,?\s*\})$/;

/**
 * Every module a file names at run time: imported, re-exported, imported for
 * its side effects, imported on demand, or required. Type-only imports and
 * exports are erased at build time and left out.
 */
function runtimeModules(text: string): string[] {
  const named = [...text.matchAll(FROM_STATEMENT)]
    .filter(([, clause]) => !TYPE_ONLY_CLAUSE.test(clause.trim()))
    .map(([, , specifier]) => specifier);
  const sideEffects = [...text.matchAll(SIDE_EFFECT_IMPORT)].map(([, specifier]) => specifier);
  const called = [...text.matchAll(CALLED)].map(([, specifier]) => specifier);
  return [...named, ...sideEffects, ...called];
}

/** A package, or any of its subpaths. */
function packageNamed(name: string): (specifier: string) => boolean {
  return specifier => specifier === name || specifier.startsWith(`${name}/`);
}

/**
 * The service registry by its file name, however it is reached — the `@/`
 * alias or a relative path such as '../../shared/services/ServiceRegistry'.
 */
const isServiceRegistry = (specifier: string) =>
  /(?:^|\/)ServiceRegistry(?:\.tsx?)?$/.test(specifier);

function importsAtRuntime(text: string, isModule: (specifier: string) => boolean): boolean {
  return runtimeModules(text).some(isModule);
}

function offenders(moduleName: string, allowedPrefix: string): string[] {
  return ALL.filter(
    ({ file, text }) =>
      !file.startsWith(allowedPrefix) && importsAtRuntime(text, packageNamed(moduleName)),
  ).map(({ file }) => file);
}

/**
 * The matcher on its own, on lines written to be caught and lines written to
 * be let through — so a boundary below that passes is known to be looking.
 */
describe('the import matcher', () => {
  const caught: [string, string][] = [
    ['default import', "import axios from 'axios';"],
    ['named import', "import { create } from 'axios';"],
    ['namespace import', "import * as http from 'axios';"],
    ['default and named', "import axios, { type AxiosInstance } from 'axios';"],
    ['across lines', "import {\n  create,\n  isAxiosError,\n} from 'axios';"],
    ['a subpath', "import mapping from 'axios/unsafe/helpers';"],
    ['side effect', "import 'axios';"],
    ['re-export of names', "export { create } from 'axios';"],
    ['re-export of everything', "export * from 'axios';"],
    ['namespace re-export', "export * as http from 'axios';"],
    ['dynamic import', "const http = await import('axios');"],
    ['require', "const http = require('axios');"],
    ['a type and a value in one brace', "import { type AxiosInstance, create } from 'axios';"],
    ['a default binding named "type"', "import type from 'axios';"],
  ];

  it.each(caught)('catches a %s', (_form, line) => {
    expect(importsAtRuntime(line, packageNamed('axios'))).toBe(true);
  });

  const erased: [string, string][] = [
    ['type import', "import type { AxiosRequestConfig } from 'axios';"],
    ['type default import', "import type Axios from 'axios';"],
    ['type namespace import', "import type * as Axios from 'axios';"],
    ['brace of types only', "import { type AxiosRequestConfig, type AxiosInstance } from 'axios';"],
    ['type re-export', "export type { AxiosRequestConfig } from 'axios';"],
    ['type re-export of everything', "export type * from 'axios';"],
    ['type query', "let http: typeof import('axios');"],
  ];

  it.each(erased)('lets a %s through', (_form, line) => {
    expect(importsAtRuntime(line, packageNamed('axios'))).toBe(false);
  });

  it('does not take a declaration followed by a type import for a value import', () => {
    const text = "export const limit = 3;\nexport function f() {}\nimport type { X } from 'axios';";

    expect(importsAtRuntime(text, packageNamed('axios'))).toBe(false);
  });

  it('does not take a package whose name only starts the same', () => {
    expect(importsAtRuntime("import x from 'axios-retry';", packageNamed('axios'))).toBe(false);
  });

  it('finds the registry by its file name, by alias or by relative path', () => {
    for (const line of [
      "import { getService } from '@/shared/services/ServiceRegistry';",
      "import { getService } from '../../shared/services/ServiceRegistry';",
      "import { getService } from './ServiceRegistry';",
      "export { getService } from '../services/ServiceRegistry';",
      "const { getService } = require('../ServiceRegistry.ts');",
    ]) {
      expect(importsAtRuntime(line, isServiceRegistry)).toBe(true);
    }
    expect(
      importsAtRuntime("import type { ServiceMap } from '../ServiceRegistry';", isServiceRegistry),
    ).toBe(false);
    expect(
      importsAtRuntime("import { x } from '@/shared/services/ServiceRegistryHelpers';", isServiceRegistry),
    ).toBe(false);
  });
});

describe('import boundaries (CLAUDE.md section 4)', () => {
  it('reads the source tree', () => {
    expect(ALL.length).toBeGreaterThan(100);
  });

  it('keeps axios inside src/core/http', () => {
    expect(offenders('axios', 'src/core/http/')).toEqual([]);
  });

  it('keeps AsyncStorage inside src/core/storage', () => {
    expect(offenders('@react-native-async-storage/async-storage', 'src/core/storage/')).toEqual([]);
  });

  it('keeps NetInfo inside the device services', () => {
    expect(offenders('@react-native-community/netinfo', 'src/shared/services/device/')).toEqual([]);
  });

  /*
    Push (phase5-contract.md section 6, 28/11/2026). Firebase is reached through
    `PushService` and nothing else — and only in `FirebasePushService`, which
    loads it on demand: a Firebase package imported anywhere at load time would
    stop a build without its native module from starting at all.
  */
  it('keeps Firebase inside the push device service', () => {
    const device = 'src/shared/services/device/FirebasePushService.ts';
    for (const name of ['@react-native-firebase/app', '@react-native-firebase/messaging']) {
      expect(offenders(name, device)).toEqual([]);
    }
    // …and is looking: the service really does load both.
    const service = ALL.find(({ file }) => file === device);
    expect(service && importsAtRuntime(service.text, packageNamed('@react-native-firebase/app'))).toBe(
      true,
    );
    expect(
      service && importsAtRuntime(service.text, packageNamed('@react-native-firebase/messaging')),
    ).toBe(true);
    // Never at the top of the file: loaded inside a function, after the check.
    expect(service?.text).not.toMatch(/^\s*import\s[^;]*['"]@react-native-firebase\//m);
  });

  it('keeps the image picker inside the image service', () => {
    expect(
      offenders('react-native-image-picker', 'src/shared/services/api/ApiImageService.ts'),
    ).toEqual([]);
    // …and is looking: the service really does import it.
    const service = ALL.find(({ file }) => file === 'src/shared/services/api/ApiImageService.ts');
    expect(service && importsAtRuntime(service.text, packageNamed('react-native-image-picker'))).toBe(
      true,
    );
  });

  it('never lets UI code reach a service or a platform library', () => {
    const forbidden: [string, (specifier: string) => boolean][] = [
      ['ServiceRegistry', isServiceRegistry],
      ...[
        'axios',
        '@react-native-async-storage/async-storage',
        '@react-native-community/netinfo',
        'react-native-permissions',
        'react-native-vector-icons',
      ].map((name): [string, (specifier: string) => boolean] => [name, packageNamed(name)]),
    ];
    /* What may name one of them anyway, and why. */
    const allowed: Record<string, string[]> = {
      // The wrapper: every other file draws an icon through it.
      'src/shared/components/Icon.tsx': ['react-native-vector-icons'],
    };

    const ui = ALL.filter(({ file }) =>
      /^src\/(features\/[^/]+\/(screens|components)|shared\/components|navigation)\//.test(file),
    );
    // Each of the three kinds is really being read, not only the first.
    expect(ui.filter(({ file }) => file.startsWith('src/features/')).length).toBeGreaterThan(20);
    expect(ui.filter(({ file }) => file.startsWith('src/shared/components/')).length).toBeGreaterThan(20);
    expect(ui.filter(({ file }) => file.startsWith('src/navigation/')).length).toBeGreaterThan(3);

    const found = ui.flatMap(({ file, text }) =>
      forbidden
        .filter(([name, isModule]) => !allowed[file]?.includes(name) && importsAtRuntime(text, isModule))
        .map(([name]) => `${file} → ${name}`),
    );
    const permissionsAndroid = ui
      .filter(({ text }) => /\bPermissionsAndroid\b/.test(text))
      .map(({ file }) => `${file} → PermissionsAndroid`);

    expect([...found, ...permissionsAndroid]).toEqual([]);
  });

  it('allows the icon wrapper its library, and so is not passing for want of reading it', () => {
    const icon = ALL.find(({ file }) => file === 'src/shared/components/Icon.tsx');

    expect(icon && importsAtRuntime(icon.text, packageNamed('react-native-vector-icons'))).toBe(true);
  });
});

/*
  An `export {}` makes this file a module, so the `__dirname` declared above is
  this file's alone. Without it the file is a script, and its declarations are
  global — the leak the ⚠️ in the header is about.
*/
export {};
