#!/usr/bin/env node

import fetch from "node-fetch";
import cheerio from 'cheerio';
import nodemailer from 'nodemailer';

const USERNAME = 'rajpatel99ladol@gmail.com'
const PASSWORD = 'Jayshreeram@123'
const SCHEDULE_ID = '49073437'
const PROVINCES = new Map([
  [89, 'Calgary'],
  [90, 'Halifax'],
  [91, 'Montreal'],
  [92, 'Ottawa'],
  [93, 'Quebec City'],
  [94, 'Toronto'],
  [95, 'Vancouver']
]);

const BASE_URI = 'https://ais.usvisa-info.com/en-ca/niv'

async function main(currentBookedDate) {
  if (!currentBookedDate) {
    log(`Invalid current booked date: ${currentBookedDate}`)
    process.exit(1)
  }

  log(`Initializing with current date ${currentBookedDate}`)

    const sessionHeaders = await login()

    while(true) {

      for(const x of PROVINCES.entries()) {

        console.log(x[0])
        const date = await checkAvailableDate(sessionHeaders, x[0])
        if (!date) {
          log("no dates available")
        } else if (date > currentBookedDate) {
          log(`nearest date is further than already booked (${currentBookedDate} vs ${date} in ${x[1]})`)
        } else {
          currentBookedDate = date
          await sendMail(`earlier date available at ${date} in ${x[1]}`)
          log(`earlier date available at ${date} in ${x[1]}`)
        }

      }
      await sleep(60*60*3);
      main(currentBookedDate)
    }
}

async function login() {
  log(`Logging in`)

  const anonymousHeaders = await fetch(`${BASE_URI}/users/sign_in`)
    .then(response => extractHeaders(response))

  return fetch(`${BASE_URI}/users/sign_in`, {
    "headers": Object.assign({}, anonymousHeaders, {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }),
    "method": "POST",
    "body": new URLSearchParams({
      'utf8': '✓',
      'user[email]': USERNAME,
      'user[password]': PASSWORD,
      'policy_confirmed': '1',
      'commit': 'Acessar'
    }),
  })
    .then(res => (
      Object.assign({}, anonymousHeaders, {
        'Cookie': extractRelevantCookies(res)
      })
    ))
}

function checkAvailableDate(headers, id) {
  return fetch(`${BASE_URI}/schedule/${SCHEDULE_ID}/appointment/days/${id}.json?appointments[expedite]=false`, {
    "headers": Object.assign({}, headers, {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    }),
    "cache": "no-store"
  })
    .then(r => r.json())
    .then(r => handleErrors(r))
    .then(d => d.length > 0 ? d[0]['date'] : null)
}

function handleErrors(response) {
  const errorMessage = response['error']

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return response
}

async function extractHeaders(res) {
  const cookies = extractRelevantCookies(res)

  const html = await res.text()
  const $ = cheerio.load(html);
  const csrfToken = $('meta[name="csrf-token"]').attr('content')

  return {
    "Cookie": cookies,
    "X-CSRF-Token": csrfToken,
    "Referer": BASE_URI,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive'
  }
}

function extractRelevantCookies(res) {
  const parsedCookies = parseCookies(res.headers.get('set-cookie'))
  return `_yatri_session=${parsedCookies['_yatri_session']}`
}

function parseCookies(cookies) {
  const parsedCookies = {}

  cookies.split(';').map(c => c.trim()).forEach(c => {
    const [name, value] = c.split('=', 2)
    parsedCookies[name] = value
  })

  return parsedCookies
}

function sleep(s) {
  return new Promise((resolve) => {
    setTimeout(resolve, s * 1000);
  });
}

function log(message) {
  console.log(`[${new Date().toISOString()}]`, message)
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'uptechnotricks@gmail.com',
    pass: 'ltbvtadttlpsbhvv'
  }
});

const sendMail = async (appointmentList) => {
  const info = await transporter.sendMail({
    from: 'uptechnotricks@gmail.com',
    to: ['rajpatel99ladol@gmail.com'],
    subject: 'US Visa Appointment Availabilities in Canada',
    text: JSON.stringify(appointmentList, null, 2)
  });

  console.log(`Email sent with messageId: ${info.messageId}`);
};

const currentBookedDate = '2024-01-01'
main(currentBookedDate)
