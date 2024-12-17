interface ApiKeyConfig {
    key: string;
    name: string;
    pattern?: RegExp;
    required: boolean;
}

const API_KEY_CONFIGS: ApiKeyConfig[] = [
    {
        key: 'SIMLI_API_KEY',
        name: 'Simli',
        pattern: /^[a-z0-9]{21}$/,  // 21 chars, lowercase + numbers
        required: true
    },
    {
        key: 'NEXT_PUBLIC_SIMLI_API_KEY',
        name: 'Public Simli',
        pattern: /^[a-z0-9]{21}$/,
        required: true
    },
    {
        key: 'ELEVENLABS_API_KEY',
        name: 'ElevenLabs',
        pattern: /^[a-f0-9]{32}$/,  // 32 char hex
        required: true
    },
    {
        key: 'OPENAI_API_KEY',
        name: 'OpenAI',
        pattern: /^sk-[A-Za-z0-9-]{48}$/,  // starts with sk- followed by 48 chars
        required: true
    },
    {
        key: 'DEEPGRAM_API_KEY',
        name: 'Deepgram',
        pattern: /^[a-f0-9]{40}$/,  // 40 char hex
        required: true
    }
];

export function validateApiKeys(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const config of API_KEY_CONFIGS) {
        const value = process.env[config.key];

        // Check if key exists
        if (!value) {
            if (config.required) {
                errors.push(`${config.name} API key (${config.key}) is missing`);
            }
            continue;
        }

        // Check if key matches expected pattern
        if (config.pattern && !config.pattern.test(value)) {
            errors.push(`${config.name} API key (${config.key}) is invalid format`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}