import { expect, test, type Page } from "@playwright/test";

import { testUser } from "./fixtures";

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png` });

test("first launch: onboarding, plan, first session, and everything that follows", async ({ page }) => {
  // ---------- onboarding
  await page.goto("/");
  await expect(page).toHaveURL(/bienvenue/);
  await shot(page, "01-welcome");
  await page.getByRole("button", { name: "Commencer" }).click();

  await page.getByLabel("Ton prénom").fill(testUser.name);
  await page.getByLabel("Adresse e-mail").fill(testUser.email);
  await page.getByLabel("Mot de passe").fill(testUser.password);
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { name: /Pourquoi veux-tu mémoriser/ })).toBeVisible();
  await page.getByRole("radio", { name: "Préparer Ramaḍān" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // free choice of scope: nothing is preselected
  await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
  await page.getByRole("button", { name: /Juz' ʿAmma, 564 versets/ }).click();
  await page.getByRole("button", { name: /Juz' Tabārak, 431 versets/ }).click();
  await expect(page.getByText("995 versets")).toBeVisible();
  await page.getByRole("tab", { name: "En partant de la fin" }).click();
  await shot(page, "02-scope");
  await page.getByRole("button", { name: "Continuer" }).click();

  // verses already known: a whole surah + one single verse
  await page.getByRole("checkbox", { name: "Je connais toute la sourate An-Naas" }).check();
  await page.getByRole("button", { name: "Choisir des versets de Al-Falaq" }).click();
  await page.getByRole("button", { name: "Verset 1", exact: true }).click();
  await expect(page.getByText(/7 versets connus dans 2 sourates/)).toBeVisible();
  // …and something known outside the goal
  await page.getByRole("tab", { name: "Tout le Coran" }).click();
  await page.getByLabel("Rechercher une sourate connue").fill("Faatiha");
  await page.getByRole("checkbox", { name: /Je connais toute la sourate Al-Faatiha/ }).check();
  await expect(page.getByText(/14 versets connus dans 3 sourates/)).toBeVisible();
  await shot(page, "03-known");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByRole("button", { name: "Ramaḍān 1448" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByText(/988 versets à apprendre en \d+ jours/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Équilibré/ })).toBeChecked();
  await shot(page, "04-pace");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByRole("button", { name: "Le soir" }).click();
  await page.getByRole("button", { name: "Générer mon plan" }).click();
  await expect(page.getByRole("heading", { name: "Ton plan est prêt" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Déjà connus")).toBeVisible();
  await shot(page, "05-plan");
  await page.getByRole("button", { name: /Voir ma première session/ }).click();

  // ---------- dashboard answers: what, how long, where am I
  await expect(page.getByRole("heading", { name: new RegExp(`${testUser.name}`) })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Juz' ʿAmma + Juz' Tabārak" })).toBeVisible();
  await expect(page.getByText(/\d+ nouveaux versets/)).toBeVisible();
  await expect(page.getByText(/Environ \d+ min/)).toBeVisible();
  await expect(page.getByText("Tu es pile dans ton rythme")).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, "05-home");

  // ---------- session: full path on the first verse, then the fast path
  await page.getByRole("button", { name: "Commencer ma session" }).click();
  await expect(page.getByText(/Nouveau verset · 1 \/ \d+/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Al-Falaq · verset 2/ })).toBeVisible();
  await expect(page.locator('p[lang="ar"]')).not.toBeEmpty();
  await page.waitForTimeout(600);
  await shot(page, "06-session-read");

  await page.getByRole("button", { name: "Passer à la répétition" }).click();
  const counter = page.getByRole("button", { name: /J'ai récité une fois/ });
  for (let i = 0; i < 5; i++) await counter.click();
  await shot(page, "07-session-repeat");
  await page.getByRole("button", { name: "Passer au test" }).click();
  await page.getByRole("button", { name: "Masquer davantage" }).click();
  await shot(page, "08-session-test");
  await page.getByRole("button", { name: "Masquer davantage" }).click();
  await page.getByRole("button", { name: "Masquer davantage" }).click();
  await page.getByRole("button", { name: "Réciter sans regarder" }).click();
  await shot(page, "09-session-recite-hidden");
  await page.getByRole("button", { name: "Révéler le verset" }).click();
  await page.getByRole("button", { name: /Mot 1 — marquer une erreur/ }).click();
  await expect(page.getByText("1 erreur marquée")).toBeVisible();
  await shot(page, "10-session-rate");
  await page.getByRole("button", { name: /^Moyen/ }).click();
  await expect(page.getByText(/reviendra/)).toBeVisible();

  const total = Number((await page.getByText(/Nouveau verset · \d+ \/ \d+/).innerText()).split("/")[1]);
  for (let i = 2; i <= total; i++) {
    await expect(page.getByText(new RegExp(`· ${i} / ${total}`))).toBeVisible();
    await page.getByRole("button", { name: "Je connais ce verset" }).click();
    await page.getByRole("button", { name: "Révéler le verset" }).click();
    await page.getByRole("button", { name: i % 2 ? /^Très facile/ : /^Facile/ }).click();
  }

  await expect(page.getByRole("heading", { name: "Session terminée" })).toBeVisible();
  await expect(page.getByText("Premier verset", { exact: true })).toBeVisible();
  await expect(page.getByText("Série de 1 jour")).toBeVisible();
  await page.waitForTimeout(700);
  await shot(page, "11-session-summary");
  await page.getByRole("button", { name: "Retour à l'accueil" }).click();

  // ---------- the day is done, learned is not mastered
  await expect(page.getByText("Journée accomplie")).toBeVisible();
  await expect(page.getByText(`${total} appris · 0 révisés`)).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, "12-home-after");

  // ---------- mastery map
  await page.getByRole("link", { name: "Ancrage" }).click();
  await expect(page.getByRole("heading", { name: "Ancrage" })).toBeVisible();
  await page.getByRole("button", { name: /An-Naas/ }).click();
  await expect(page.getByRole("button", { name: /Verset 1, Appris/ })).toBeVisible();
  await shot(page, "13-mastery-map");
  await page.getByRole("button", { name: /Verset 1, Appris/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Prochaine révision");
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).last().click();
  // declare more known verses later, from the map
  await page.getByRole("button", { name: "Je connais déjà…" }).click();
  await page.getByRole("checkbox", { name: "Je connais toute la sourate An-Nasr" }).check();
  await page.getByRole("button", { name: "Ajouter 3 versets" }).click();
  await expect(page.getByText(/3 versets ajoutés/)).toBeVisible();

  // ---------- calendar, journey
  await page.getByRole("link", { name: "Calendrier" }).click();
  await expect(page.getByText("Série : 1 jour")).toBeVisible();
  await shot(page, "14-calendar");
  await page.getByRole("link", { name: "Parcours" }).click();
  await expect(page.getByRole("heading", { name: "Débutant" })).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, "15-journey");

  // ---------- goals: add a weekly goal, move the target date
  await page.goto("/objectifs");
  await expect(page.getByText("Objectif principal")).toBeVisible();
  await page.getByRole("button", { name: /Nouvel objectif/ }).click();
  await page.getByRole("radio", { name: "Hebdo" }).click();
  await page.getByRole("button", { name: "Créer l'objectif" }).click();
  await expect(page.getByRole("heading", { name: "50 versets par semaine" })).toBeVisible();
  await expect(page.getByText(`${total} / 50 versets cette semaine`)).toBeVisible();
  await shot(page, "16-goals");
  await page.getByRole("button", { name: "Modifier la date" }).first().click();
  await page.getByLabel("Nouvelle date cible").fill("2027-03-31");
  await page.getByRole("button", { name: "Recalculer mon plan" }).click();
  await expect(page.getByText("31 mars 2027")).toBeVisible();

  // ---------- settings: reminder from onboarding, dark mode persists after reload
  await page.goto("/reglages");
  await expect(page.getByText("20:30")).toBeVisible();
  await page.getByRole("radio", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Réglages" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/");
  await expect(page.getByText("Journée accomplie")).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, "17-home-dark");

  // ---------- logout / login
  await page.goto("/reglages");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/connexion|bienvenue/);
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(testUser.email);
  await page.getByLabel("Mot de passe").fill(testUser.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Juz' ʿAmma + Juz' Tabārak" })).toBeVisible();
});
