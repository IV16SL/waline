const { version } = require('../../package.json');

module.exports = class extends think.Controller {
  indexAction() {
    this.type = 'html';
    this.body = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Waline</title>
      <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAFhklEQVR4nMVWa2xTZRh+vnPtabuul13cEAhRINEYgwGJytgFnIhuGn8IhhA0HXP4g4s/lI0gE8Y1QFgIaMgwEAhGTTR0QyKLwxFug4hGJf6AcXEIwtwF1m3tes73+qOcetq1k8kIT9K07/d+53me95z3e3uAhwx2Pxe/8EGDA0wYwxhzAdCJeDuIrp3Y9Cp/IAamfVgPJqpTZId7nqQ6iwVZmShIqsAEESACNyLgejhoRMIn9b7bB/VQz+fHN8zuGhED01c2Pae6MjcqDk+eqNr/81LiBiJ93cGBYOeOgWDHuuPrX77zvwxMW35YUV1ZG23u7MWi6hDu1XDMCHEM9HS0hW7fnN9cndc8LAN5Kxpdmif3oJr+SAEThq0dByPcG+nvul7etOLZPfdkIG9Fo83uG92ourKmgd1Xr8bAIyHe3/nngu+rJu8311KWpXlG7RxJcQAQZJtg8+TWFda0TB7SwMwN50pUV+Y7IyluQlQ01ZaetXf6yqNKUgP5q5olxZmxhYkSABCAHQD8AE4m4TsNYA6AagCRFJqtAN4CUALgGADIWvoTtvTsciBJD7y4+fybmjvnCzAGEO0PlHnnA0BpXYcTjF0CWGZ0J+nE+aj6hRm3ovnOajC2KpGPuDG5fmHGjwBQUtfhZIy1AixLD/de7b11+bFBd0DWXG+bt96IhK6Y64EyX5CIdsWIDWMg+NfFDjPmXN8BoD9BHP2d138x4/oyX5C4cQoAREUbqzg8RXEGitae0QRJKYoREJ+T/1GzYCHcCWAAAJgg2iWbs9TMNZRntYPogJWPMQEAlVrXyDC8Zk7WXLPjDEia62lBlFUzFhVtvOL0zraIXAfRV3fZIWtpSxIqrkW0b0wHUNJ8e4vWnnkeAArXnPaCsSmxtCRPjTMgKtp4a+czJkCyu5bGiZBR++9+e/6M9ecmmXF9eeavIGqKK0p1ODTfGCcAKA53pSApNgv/43EGBFHyIAGSYi+asf7cUzEDeugsiE4AABMlKA5P/F0gXhvPQJ9AxJGimjMvyXb3MmuGMcEb34Rs8FhgosRkh3uxGTcsGh0nIira3MKalmwz5kbkEIgumHHf323dfTcuLbN5c78WZFWMJ2eD5kDSv05Jsc8rXHM6wyLyDYi6AUCQVVVxeheZuUMVOZxA281Y8z1a6cyZsFVSHfYk1J3xBoguJjMgyKqmOL0VsapuXlI41yWLwYqC6uOx5iVD3wPQ7WiRApgQX7gFrXEGuBH5GUThZDslm7Oy4OMTFXlVRwplh/tLQZScZk5UtGwlzTvXjBveze4hot2pVC1oGTQJS+o6DjMmzEq2m7gBMiJhQVK3gbFbAJYAGAMAeij4U/Bm6zPHVhdEeXa1j2OidAFAyvK5ESke3HVEe1JdwAQRTFJWB8q8ywN+z1bixutmTlS0SYrDk2/G9eWZl4l4YyouEP3Bdb1pkIFQ94126yxJhBHqbTV/93e0tRI3YuZke/pS616uD/QjBQi05dv3cg3Jujh9ZZMi2dK2D/WiRFx/P6/qu6Pc0LuYKK22vimJqv21opqWxeE77ftkh2cmY8IrKVh+J258CiQoFW8+X2lz56wb8j2ACJG+bp1zI6I4PFpih5OhIxLqgaTaIUhqMoYwiPICZd6zcQYK15waZ88Y+5uoaMnO60iBAFoQ8Hv3mQsCAORVHYGalrn9AYvrAMqs4gAgAYDqynxDdrhTPK8RwTUA8wN+zw+JCSF/VbNTSfNtG2JaAdFj0Q4g6aQcAr0ANgF4Mpk4AEiqK6tasjlH3xW4kvC5an4H/J5g6WddAGEqgHkAigFMwOAj0wvgFICDAA4E/J7OoRyyWbUXJypO37WA39M7zOpQursrDdFJ6EL0GbcDaAv4PcZwuR4a/gHRPvjLlm5gaAAAAABJRU5ErkJggg==">
    </head>
    <body>
      <div id="waline" style="max-width: 800px;margin: 0 auto;"></div>
      <link href='//unpkg.com/@waline/client@v3/dist/waline.css' rel='stylesheet' />
      <script type="module">
        import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';

        console.log(
          '%c @waline/server %c v${version} ',
          'color: white; background: #0078E7; padding:5px 0;',
          'padding:4px;border:1px solid #0078E7;'
        );
        const params = new URLSearchParams(location.search.slice(1));
        const waline = init({
          el: '#waline',
          path: params.get('path') || '/',
          lang: params.get('lng') || undefined,
          serverURL: location.protocol + '//' + location.host + location.pathname.replace(/\\/+$/, ''),
          recaptchaV3Key: '${process.env.RECAPTCHA_V3_KEY || ''}',
          turnstileKey: '${process.env.TURNSTILE_KEY || ''}',
        });
      </script>
    </body>
    </html>`;
  }
};
