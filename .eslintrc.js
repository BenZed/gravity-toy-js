/* eslint-env node */

module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'eslint-plugin-react',
        'eslint-plugin-react-hooks'
    ],
    root: true
}