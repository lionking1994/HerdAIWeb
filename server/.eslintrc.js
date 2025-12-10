/**
 * ESLint Configuration with Security Rules
 * 
 * This configuration includes security-focused plugins to detect
 * common vulnerabilities and insecure coding patterns.
 */

module.exports = {
  env: {
    node: true,
    es2022: true,
    commonjs: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: [
    'security',
    'no-secrets',
  ],
  rules: {
    // ============================================
    // SECURITY RULES (eslint-plugin-security)
    // ============================================
    
    // Detect unsafe regular expressions (ReDoS)
    'security/detect-unsafe-regex': 'error',
    
    // Detect buffer overflow vulnerabilities
    'security/detect-buffer-noassert': 'error',
    
    // Detect child_process with non-literal arguments
    'security/detect-child-process': 'warn',
    
    // Detect eval() usage
    'security/detect-eval-with-expression': 'error',
    
    // Detect non-literal fs filename
    'security/detect-non-literal-fs-filename': 'warn',
    
    // Detect non-literal regexp
    'security/detect-non-literal-regexp': 'warn',
    
    // Detect non-literal require
    'security/detect-non-literal-require': 'warn',
    
    // Detect object injection
    'security/detect-object-injection': 'warn',
    
    // Detect possible timing attacks
    'security/detect-possible-timing-attacks': 'warn',
    
    // Detect pseudoRandomBytes usage
    'security/detect-pseudoRandomBytes': 'error',
    
    // Detect bidi characters (Trojan Source attacks)
    'security/detect-bidi-characters': 'error',
    
    // Detect new Buffer() usage (deprecated, security risk)
    'security/detect-new-buffer': 'error',
    
    // Detect disable mustache escape
    'security/detect-disable-mustache-escape': 'error',
    
    // Detect no csrf before method override
    'security/detect-no-csrf-before-method-override': 'error',
    
    // ============================================
    // SECRETS DETECTION
    // ============================================
    
    // Detect hardcoded secrets
    'no-secrets/no-secrets': ['error', { 
      ignoreContent: [
        'sk_test_', // Allow test keys in comments
        'pk_test_',
      ],
      tolerance: 4.5,
    }],
    
    // ============================================
    // GENERAL SECURITY BEST PRACTICES
    // ============================================
    
    // Disallow eval()
    'no-eval': 'error',
    
    // Disallow implied eval()
    'no-implied-eval': 'error',
    
    // Disallow new Function()
    'no-new-func': 'error',
    
    // Disallow script URLs
    'no-script-url': 'error',
    
    // Require strict mode
    'strict': ['error', 'global'],
    
    // Disallow with statements
    'no-with': 'error',
    
    // ============================================
    // CODE QUALITY (Security-Related)
    // ============================================
    
    // Require === and !==
    'eqeqeq': ['error', 'always'],
    
    // Disallow unused variables (potential data exposure)
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    
    // Require error handling in callbacks
    'handle-callback-err': 'warn',
    
    // Disallow console.log in production (potential info leakage)
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    
    // Disallow debugger statements
    'no-debugger': 'error',
    
    // Require const/let instead of var
    'no-var': 'error',
    
    // Prefer const over let when possible
    'prefer-const': 'warn',
  },
  overrides: [
    {
      // Test files can have relaxed rules
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
      rules: {
        'no-secrets/no-secrets': 'off',
        'security/detect-non-literal-fs-filename': 'off',
      },
    },
    {
      // Migration files may need dynamic SQL
      files: ['**/migrations/**/*.js', '**/scripts/**/*.js'],
      rules: {
        'security/detect-sql-injection': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.min.js',
  ],
};

