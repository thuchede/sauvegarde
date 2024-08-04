import open from 'open';

const {promise, resolve} = Promise.withResolvers<{searchParams: URLSearchParams}>()
const server = Bun.serve({
    port: 8654,
    async fetch(req, server) {
        const {pathname: path, hash, searchParams, search } = new URL(req.url);
        if (path === "/api") {
            return Response.json({ some: "buns", for: "you" });
        }
        if (path === "/callback") {
            resolve({ searchParams })

            // FIXME: need to obtain refresh token if session is >1h
            // https://developers.google.com/identity/protocols/oauth2#5.-refresh-the-access-token,-if-necessary.
            return Response.json({ });
        }
        if (path === "/login") {

            const randomValues = new Uint32Array(2);
            crypto.getRandomValues(randomValues);

            // Encode as UTF-8
            const utf8Encoder = new TextEncoder();
            const utf8Array = utf8Encoder.encode(
                String.fromCharCode(...randomValues))
            const state = btoa(String.fromCharCode(...utf8Array))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const YOUR_CLIENT_ID = '265405369267-mnfudu2s6pbe8a75chv460fvib49so65.apps.googleusercontent.com';
            const YOUR_REDIRECT_URI = 'http://localhost:8654/callback';
            const oauth2Endpoint = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${YOUR_CLIENT_ID}redirect_uri=${YOUR_REDIRECT_URI}&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.metadata.readonly&state=${state}&include_granted_scopes=true&response_type=token`;
            const res = await fetch(oauth2Endpoint)
            const json = await res.json();
            return Response.json(json);
        }


        return new Response(Bun.file("./index.html"));
    },
})

console.log("started 8654");

await open("http://localhost:8654")
console.log("awaiting browser login>");
const v  = await promise;

server.stop();

console.log('received', JSON.stringify(v));


const test = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
            'Authorization': `Bearer ${v.searchParams.get('access_token')}`,
        }
    });

const testjson = await test.json();

console.log("_______");
console.log(testjson);
console.log("_______");
//
// const res = await fetch('http://localhost:8654/login')
// console.log("v", JSON.stringify(v));

