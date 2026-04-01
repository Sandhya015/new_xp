# 🚀 Getting started with Strapi

## XpertIntern blog (steps 1–5)

This project is wired for the React app in `../frontend` (blog pages read `/api/articles`).

| Step | Status |
|------|--------|
| **1. Run Strapi** | Node 20+, then `npm run develop` → open [http://localhost:1337/admin](http://localhost:1337/admin) and create the first admin user (one-time). |
| **2. Article type** | Already added: **Article** with `title`, `slug` (UID from title), `description` (rich text), `coverImage` (media), `category` (enum), `readTime`, `publishedDate`. See `src/api/article/`. |
| **3. Sample post** | In admin: **Content Manager → Article → Create** → fill fields → **Publish** (drafts are hidden from the public API). |
| **4. Public API** | **find** and **findOne** for Article are enabled for the **Public** role automatically on startup (`src/index.ts` bootstrap). You can still verify under **Settings → Users & Permissions → Roles → Public**. |
| **5. Test** | With Strapi running: [http://localhost:1337/api/articles?populate=*](http://localhost:1337/api/articles?populate=*) — expect JSON (`data` may be `[]` until you publish posts). |

Frontend default Strapi URL is `http://localhost:1337`, or set `VITE_STRAPI_URL` in the Vite app.

---

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
