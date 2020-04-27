const puppeteer = require('puppeteer')
const oauth = require('oauth')

const waitOptions = {waitUntil: 'networkidle0', timeout: 90000}
const orderEntryUrl = 'https://client.schwab.com/Areas/Trade/Stocks/Entry.aspx?'
const schwabSignInUrl = 'https://lms.schwab.com/Login?ClientId=schwab-secondary&StartInSetId=1&enableAppD=false&RedirectUri=client.schwab.com/Login/Signon/AuthCodeHandler.ashx'

const usernameFieldSelector = 'input[name=LoginId]'
const passwordFieldSelector = 'input[name=Password]'
const submitLinkSelector = '#LoginSubmitBtn'

const typingDelay = 100

const SPLG = 'SPLG'

const findLastPrice = async (symbol, consumerKey, consumerSecret, accessToken, accessSecret) => {
    const configuration = {
        api_url: "https://api.tradeking.com/v1",
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        access_token: accessToken,
        access_secret: accessSecret
    }

    const tradeking_consumer = new oauth.OAuth(
        "https://developers.tradeking.com/oauth/request_token",
        "https://developers.tradeking.com/oauth/access_token",
        configuration.consumer_key,
        configuration.consumer_secret,
        "1.0",
        "http://mywebsite.com/tradeking/callback",
        "HMAC-SHA1");

    return new Promise((resolve, reject) => {
        tradeking_consumer.get(`https://api.tradeking.com/v1/market/ext/quotes.json?symbols=${symbol}`,
            configuration.access_token, configuration.access_secret,
            function (error, data, response) {
                if (error) {
                    reject(error)
                } else {
                    // Parse the JSON data
                    const jsonData = JSON.parse(data)
                    // Display the response
                    console.log(jsonData.response.quotes.quote.ask)
                    resolve(jsonData.response.quotes.quote.ask)
                }
            }
        )
    })
}

const buyInAllyAccount = async (symbol, consumerKey, consumerSecret, accessToken, accessSecret, costBasis, lastPrice, limit) => {
    console.log(`Using consumerKey=${consumerKey}, consumerSecret=${consumerSecret}, accessToken=${accessToken}, accessSecret=${accessSecret}, cost basis=${costBasis}, and limit=${limit}`)

    const configuration = {
        api_url: "https://api.tradeking.com/v1",
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        access_token: accessToken,
        access_secret: accessSecret
    }

    const tradeking_consumer = new oauth.OAuth(
        "https://developers.tradeking.com/oauth/request_token",
        "https://developers.tradeking.com/oauth/access_token",
        configuration.consumer_key,
        configuration.consumer_secret,
        "1.0",
        "http://mywebsite.com/tradeking/callback",
        "HMAC-SHA1")

    const shares = Math.trunc(costBasis / lastPrice)
    const postBody = `<FIXML xmlns="http://www.fixprotocol.org/FIXML-5-0-SP2">
<Order TmInForce="0" Typ="2" Side="1" Acct="60515267" Px="${limit}">
<Instrmt SecTyp="CS" Sym="${symbol}"/>
<OrdQty Qty="${shares}"/>
</Order>
</FIXML>`

    return new Promise((resolve, reject) => {
        tradeking_consumer.post(`https://api.tradeking.com/v1/accounts/60515267/orders.json`,
            configuration.access_token, configuration.access_secret,
            postBody, 'text/xml', function (error, data, response) {
                if (error) {
                    reject(error)
                } else {
                    const jsonData = JSON.parse(data)
                    resolve()
                }
            }
        )
    })
}

const buyInSchwabAccount = async (username, password, costBasis, lastPrice, limit) => {
    console.log(`Using username=${username}, password=${password}, cost basis=${costBasis}, and limit=${limit}`)
    let browser
    try {
        browser = await puppeteer.launch({headless: false})
        const page = await browser.newPage()

        const shares = Math.trunc(costBasis / lastPrice)
        console.log(`Buying ${shares} shares at $${lastPrice}.`)

        await page.goto(schwabSignInUrl, waitOptions)

        await signIn(page, username, password)
        await page.waitForSelector('.acctNavigate-button-link')
        await page.click('.acctNavigate-button-link')
        await page.waitForNavigation(waitOptions)
        await page.waitForSelector('.account')
        await page.goto(orderEntryUrl, waitOptions)

        await orderDetails(page, SPLG, shares, limit)
        await page.click('#btnConfirm')
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

const orderDetails = async (page, symbol, shares, limit) => {
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

    const limitFieldSelector = '.field-limit'
    await page.focus(limitFieldSelector)
    await page.type(limitFieldSelector, limit.toString(), {delay: typingDelay})

    const reviewSelector = '#btnReview'

    return Promise.all([
        page.waitForNavigation(waitOptions),
        page.click(reviewSelector),
    ])

}

const querySelector = selector => {
    return document.querySelector(selector).innerText
}

const run = async args => {
    try {
        const consumerKey = args[8]
        const consumerSecret = args[9]
        const oauthToken = args[10]
        const oauthSecret = args[11]
        const allyCostBasis = args[12]

        const lastPrice = await findLastPrice(SPLG, consumerKey, consumerSecret, oauthToken, oauthSecret)
        const limit = (lastPrice * 1.005).toFixed(2)

        await buyInAllyAccount(SPLG, consumerKey, consumerSecret, oauthToken, oauthSecret, allyCostBasis, lastPrice, limit)
        await buyInSchwabAccount(args[2], args[3], args[4], lastPrice, limit)
        await buyInSchwabAccount(args[5], args[6], args[7], lastPrice, limit)

        process.exit(0)
    } catch (e) {
        throw e
    }
}

const args = process.argv
if (args.length !== 13) {
    throw "Usage: node index.js <dustin_username> <dustin_password> <dustin cost basis> " +
    "<leighann_username> <leighann_password> <leighann cost basis> " +
    "<ally consumerKey> <ally consumerSecret> <ally oauthToken> <ally oauthSecret> <ally cost basis>"
}

run(args)