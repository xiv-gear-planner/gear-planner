export const ALL_LANGS = ['en', 'de', 'fr', 'ja'] as const;

export function isValidLanguage(languageMaybe: string): languageMaybe is Language {
    return ALL_LANGS.includes(languageMaybe as Language);
}

export type Language = typeof ALL_LANGS[number];

export type TranslationData = Record<Language, string>;

export type TranslatableString = TranslationData & {
    get asCurrentLang(): string;
};

export const LangaugeDisplayName: TranslationData = {
    'en': 'English',
    'de': 'Deutsch',
    'fr': 'Français',
    'ja': '日本語',
} as const;

let currentLang: null | Language = null;

export function getCurrentLanguage(): Language {
    return currentLang ?? 'en';
}

export function setCurrentLanguage(lang: Language) {
    currentLang = lang;
}

class TranslatableImpl implements TranslatableString {

    constructor(private readonly defaultValue: string, private readonly data: Partial<TranslatableString>) {
    }

    get de() {
        return this.data['de'] ?? this.defaultValue;
    }

    get en() {
        return this.data['en'] ?? this.defaultValue;
    }

    get fr() {
        return this.data['fr'] ?? this.defaultValue;
    }

    get ja() {
        // TODO
        return this.data['ja'] ?? this.defaultValue;
    }

    get asCurrentLang(): string {
        return this.data[getCurrentLanguage()] ?? this.defaultValue;
    }

    toString() {
        return this.asCurrentLang;
    }

}

export function toTranslatable(defaultValue: string, data: Partial<TranslatableString> = {}, mapper?: (input: string) => string): TranslatableString {
    if (mapper) {
        const adjustedData: typeof data = {};
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'string') {
                adjustedData[key as keyof TranslationData] = mapper(value);
            }
            else {
                adjustedData[key as keyof TranslationData] = value;
            }
        });
        return new TranslatableImpl(mapper(defaultValue), adjustedData);
    }
    else {
        return new TranslatableImpl(defaultValue, data);
    }
}
