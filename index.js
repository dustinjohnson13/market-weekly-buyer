const puppeteer = require('puppeteer')

const waitOptions = {waitUntil: 'networkidle0', timeout: 90000}
const orderEntryUrl = 'https://client.schwab.com/Areas/Trade/Stocks/Entry.aspx?'
const schwabSignInUrl = 'https://lms.schwab.com/Login?ClientId=schwab-secondary&StartInSetId=1&enableAppD=false&RedirectUri=client.schwab.com/Login/Signon/AuthCodeHandler.ashx'

const usernameFieldSelector = 'input[name=LoginId]'
const passwordFieldSelector = 'input[name=Password]'
const submitLinkSelector = '#LoginSubmitBtn'

const typingDelay = 100

const SPLG = 'SPLG'
const run = async (username, password, costBasis) => {
    let browser
    try {
        browser = await puppeteer.launch({headless: false})
        const page = await browser.newPage()

        await page.goto('https://www.nasdaq.com/market-activity/funds-and-etfs/splg', waitOptions)
        const price = await page.evaluate(querySelector, '.symbol-page-header__pricing-price');
        const lastPrice = price.substring(1)
        const shares = Math.trunc(costBasis / lastPrice)
        console.log(`Buying ${shares} shares at $${lastPrice}.`)

        await page.goto(schwabSignInUrl, waitOptions)

        await signIn(page, username, password)
        await page.waitForSelector('.acctNavigate-button-link')
        await page.click('.acctNavigate-button-link')
        await page.waitForNavigation(waitOptions)
        await page.waitForSelector('.account')
        await page.goto(orderEntryUrl, waitOptions)

        await orderDetails(page, SPLG, shares, lastPrice)
        await page.click('#btnConfirm')

        process.exit(0)
    } catch (e) {
        throw e
    } finally {
        await browser.close()
    }
}

const signIn = async (page, username, password) => {

    const response = await Promise.all([
        page.waitForSelector(passwordFieldSelector),
        page.waitForSelector(usernameFieldSelector),
    ])
    await page.focus(passwordFieldSelector)
    await page.type(passwordFieldSelector, password, {delay: typingDelay})

    await page.focus(usernameFieldSelector)
    await page.type(usernameFieldSelector, username, {delay: typingDelay})

    return Promise.all([
        page.waitForNavigation(waitOptions),
        page.click(submitLinkSelector)
    ])

}

const orderDetails = async (page, symbol, shares, lastPrice) => {
    const orderTypeSelector = '.field-ordertype'
    await page.select(orderTypeSelector, 'Limit')

    const symbolFieldSelector = '.field-symbol'
    await page.focus(symbolFieldSelector)
    await page.type(symbolFieldSelector, symbol, {delay: typingDelay})

    const actionFieldSelector = '.field-action'
    // await page.focus(actionFieldSelector)
    await page.select(actionFieldSelector, 'Buy')

    const quantityFieldSelector = '.frm-qty'
    await page.focus(quantityFieldSelector)
    await page.type(quantityFieldSelector, shares.toString(), {delay: typingDelay})

    const limit = (lastPrice * 1.005)
    const limitFieldSelector = '.field-limit'
    await page.focus(limitFieldSelector)
    await page.type(limitFieldSelector, limit.toFixed(2).toString(), {delay: typingDelay})

    const reviewSelector = '#btnReview'

    return Promise.all([
        page.waitForNavigation(waitOptions),
        page.click(reviewSelector),
    ])

}

const querySelector = selector => {
    return document.querySelector(selector).innerText
}

const args = process.argv
if (args.length !== 5) {
    throw "Usage: node index.js <username> <password>"
}

try {
    run(args[2], args[3], args[4])
} catch (e) {
    throw e
}
