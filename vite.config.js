process.env.VITE_APP_VER = process.env.npm_package_version
    .replace(/\-|alpha|beta/g, match => ({
        '-': ' ',
        'alpha': 'Alpha',
        'beta': 'Beta'
    }[match]));

export default {
    base: '/flmml-visualsequencer/'
}