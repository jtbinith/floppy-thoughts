import type { ReactNode } from 'react'
import { CONTACT_EMAIL, POLICY_DATE, RUN_BY, RUN_BY_URL } from '../lib/site'
import { NavBar } from './NavBar'

// The privacy policy and the terms, in plain words, and the footer that links to them.
// The fuller reasoning behind them is in docs/database.md ("Privacy and data").

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export function SiteFooter() {
  return (
    <footer className="home__footer">
      <span>Floppy Thoughts · ideas worth hacking on</span>
      <span>
        <a href="#/privacy">privacy</a> · <a href="#/terms">terms</a> · <Mail />
      </span>
      <span>
        built with <a href="https://reactflow.dev">React Flow</a>, <a href="https://threejs.org">three.js</a>, <a href="https://zod.dev">Zod</a> and{' '}
        <a href="https://www.datamuse.com/api/">Datamuse</a>
      </span>
    </footer>
  )
}

function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="home">
      <NavBar current="info" />
      <main className="info">
        <h1>{title}</h1>
        <p className="info__date">Last changed {POLICY_DATE}</p>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

export function PrivacyPage() {
  return (
    <InfoPage title="privacy">
      <p>
        Floppy Thoughts is a free, open-source project run by <a href={RUN_BY_URL}>{RUN_BY}</a>. Questions, requests or takedowns: <Mail />.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>Without an account, your boards never leave your browser.</li>
        <li>With one, your boards are stored so you can share them and open them anywhere. That&apos;s the only reason anything is kept.</li>
        <li>No ads, no tracking, no analytics and no cookies. Nothing is sold or shared beyond the services that run the site.</li>
        <li>You can download everything or delete your account from your account page at any time.</li>
      </ul>

      <h2>What&apos;s kept and why</h2>
      <table>
        <thead>
          <tr>
            <th>What</th>
            <th>Where from</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Your GitHub username, picture and email</td>
            <td>GitHub, when you sign in</td>
            <td>To sign you in and to show others on a board who added or favourited something</td>
          </tr>
          <tr>
            <td>Your boards, boxes, links and favourites</td>
            <td>You</td>
            <td>They&apos;re your boards</td>
          </tr>
          <tr>
            <td>Who&apos;s on each board, their roles and invite links</td>
            <td>You, when you share</td>
            <td>So the right people can open a board</td>
          </tr>
        </tbody>
      </table>
      <p>The legal reason is that it&apos;s needed to give you the service you signed up for.</p>

      <h2>Who sees what</h2>
      <ul>
        <li>A board and everything on it is seen only by the people on it.</li>
        <li>Your name and picture are seen by people on boards you&apos;re on.</li>
        <li>Your email is seen by no one else.</li>
      </ul>

      <h2>Services that handle it</h2>
      <ul>
        <li>
          <strong>Supabase</strong> stores accounts and boards, in London.
        </li>
        <li>
          <strong>GitHub</strong> signs you in, so it knows you use Floppy Thoughts. It also hosts this site and keeps the usual request logs
          (IP addresses and pages loaded) for a short time.
        </li>
        <li>
          <strong>Datamuse</strong> is asked for related words when you ask for a nudge. Like any website it sees your IP address, along with that one word.
        </li>
      </ul>

      <h2>How long it&apos;s kept</h2>
      <ul>
        <li>Your account and boards: until you delete them.</li>
        <li>
          If you don&apos;t sign in for 24 months, your account and the boards you own are deleted. You&apos;ll be emailed a month before, a week before and
          on the day. Signing in keeps it.
        </li>
        <li>Invite links: until they&apos;re reset or turned off.</li>
      </ul>

      <h2>In your browser</h2>
      <p>No cookies. The browser keeps, on your device only:</p>
      <ul>
        <li>your boards, if you&apos;re not signed in;</li>
        <li>your settings (light or dark, panel sizes and sort order) and which notes you&apos;ve seen;</li>
        <li>if you&apos;re signed in: your sign-in, a copy of your account&apos;s boards and any changes not sent yet, so boards work without a connection. These go when you sign out.</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li>
          <strong>See and download</strong> everything: on your <a href="#/account">account page</a>.
        </li>
        <li>
          <strong>Delete your account</strong>: also there. Your boards go with it. Boxes you added to other people&apos;s boards stay so their work
          isn&apos;t lost. Your name is taken off them.
        </li>
        <li>
          <strong>Correct</strong> your name or picture: change them on GitHub and they update next time you sign in.
        </li>
        <li>
          <strong>Ask</strong> anything else or object to something: <Mail />. You can also contact the{' '}
          <a href="https://ico.org.uk/make-a-complaint/">ICO</a>, the UK&apos;s data protection regulator.
        </li>
      </ul>

      <h2>Changes</h2>
      <p>If this changes in a way that matters, signed-in people will be told by email first.</p>
    </InfoPage>
  )
}

export function TermsPage() {
  return (
    <InfoPage title="terms">
      <p>By signing in you agree to these.</p>
      <ul>
        <li>
          <strong>It&apos;s free and as it is.</strong> It&apos;s run by a volunteer with no promise it&apos;ll always be up or that nothing will
          ever be lost. Download anything you can&apos;t lose.
        </li>
        <li>
          <strong>You sign in with GitHub</strong>, so GitHub&apos;s age rule applies: 13 or over.
        </li>
        <li>
          <strong>What you write is yours.</strong> Floppy Thoughts only stores and shows it to the people on your board.
        </li>
        <li>
          <strong>Be decent on shared boards.</strong> No pretending to be someone else, harassment, sharing other people&apos;s personal details, spam
          or trying to get into boards you weren&apos;t invited to.
        </li>
        <li>
          <strong>Accounts can be closed</strong> for breaking these, with a warning first where that&apos;s reasonable.
        </li>
        <li>
          <strong>The law</strong> of England and Wales applies.
        </li>
      </ul>
      <p>
        Questions: <Mail />. How your data is handled: the <a href="#/privacy">privacy</a> page.
      </p>
    </InfoPage>
  )
}
