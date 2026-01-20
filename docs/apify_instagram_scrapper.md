Apify SDK documentation:

API Key: apify_api_Y3EEdpDIlyW0Q1fbH9YJcOdeXGzHdS0TRFEa

What does Instagram Scraper do?
Instagram Scraper allows you to scrape posts from a user's profile page, hashtag page, or place. When a link to an Instagram post is provided, it can scrape Instagram comments.

This unofficial Instagram API is designed to give you back the functionality to access public data that was removed from the Instagram API in 2020. It also enables anyone to extract public data from Instagram without imposing limits on whether you are an Instagram Business or Creator, or whether you are accessing public consumer account data.

The Instagram data scraper supports the following features:

Scrape profiles - you can either scrape posts or get metadata from the profile.
Scrape hashtags - query hashtags matched by search keyword - you can either scrape posts or scrape metadata from each hashtag.
Scrape places/locations - query places matched by search keyword - you can either scrape posts or scrape metadata from each place.
Scrape comments - you can scrape comments from any post.
What are other Instagram scraping tools?
If you want to scrape specific Instagram data, you can use any of the dedicated scrapers with fewer settings to change and faster results. Just enter one or more Instagram usernames or URLs and click to scrape.

👤 Instagram Profile Scraper	🎞️ Instagram Reel Scraper
#️⃣ Instagram Hashtag Scraper	📷 Instagram Post Scraper
🏷️ Instagram Mentions Scraper	✅ Quick Instagram Posts Checker
👥 Instagram Followers Count Scraper	💬 Instagram Comments Scraper
📊 Instagram Hashtag Stats	
Why scrape Instagram?
Instagram has about 1 billion monthly active users and is especially popular with younger users, a demographic that can otherwise be difficult for brands to reach. With so many active users, you can imagine that there is a lot of useful data on the site.

So what can you do with that data? Here are some ideas:

Scrape hashtags and likes to see what's becoming popular. Maybe you can get involved early or create a niche product to take advantage of short-term trends.
Get data based on location to discover opportunities or risks that might affect your investment or business decisions.
Scrape comments to understand how real customers see your brand or business.
Find Instagram influencers who could help you promote your products, and track their engagement in real time.
Collect a constantly updated dataset on your industry, city, or interests and gain insights into ongoing change.
Carry out market or academic research that goes beyond surveys and polls.
If you want more ideas, check out our industries pages for ways web scraping is already being used in a wide range of companies.

How to use Instagram Scraper
If you want to know more about how Instagram Scraper works, here's a detailed explanation and step-by-step guide with screenshots and examples. You can also follow this video for guidance:



How many results can you scrape with Instagram scraper?
The number of results Instagram scraper can return varies heavily based on the content you want to scrape. To get an idea you can always open the required url in an incognito window in your browser (Chrome, for example) and check what Instagram shows users who are not logged in.

You have to keep in mind that scraping Instagram is dynamic and subject to change. There’s no one-size-fits-all-use-cases number. The maximum number of results may vary depending on the complexity of the input, location, and other factors.

Therefore, while we regularly run Actor tests to keep the benchmarks in check, the results may also fluctuate without our knowing. The best way to know for sure for your particular use case is to do a test run yourself.

How much will scraping Instagram cost you?
This scraper uses a pay-per-result pricing model, so costs are simple to calculate: it will cost you $2.30 to scrape 1,000 Instagram comments, which comes to $0.0023 per comment. With the Apify Free plan, you get $5 free usage credits each month, allowing you to scrape over 2,100 Instagram comments for free with those credits.

For regular data extraction, we recommend the $49/month Starter plan — this would let you scrape over 21,000 Instagram comments every month.

Is it legal to scrape Instagram?
Our Instagram scrapers are ethical and do not extract any private user data, such as email addresses, gender, or location. They only extract what the user has chosen to share publicly. We therefore believe that our scrapers, when used for ethical purposes by Apify users, are safe. However, you should be aware that your results could contain personal data. Personal data is protected by the GDPR in the European Union and by other regulations around the world. You should not scrape personal data unless you have a legitimate reason to do so. If you're unsure whether your reason is legitimate, consult your lawyers. You can also read our blog post on the legality of web scraping.

Input parameters
The input of this scraper should be JSON containing the list of pages on Instagram that should be visited. Check the input tab for detailed list.

Instagram scraper input example
{
    "search": "Niagara Falls",
    "searchType": "place",
    "searchLimit": 10,
    "resultsType": "posts",
    "resultsLimit": 100
}

During the Actor run
During the run, the actor will output messages letting you know what's going on. Each message always contains a short label specifying which page from the provided list is currently being scraped. When items are loaded from the page, you should see a message about this event with a loaded item count and total item count for each page, in most cases.

If you provide incorrect input to the actor, it will immediately stop with a failure state and output an explanation of what is wrong.

Instagram output format
The actor stores its results in a dataset. Each item is a separate item in the dataset.

You can manage the results in any language (Python, PHP, Node.js/NPM). See our API reference to learn more about getting results from the Instagram Scraper.

Scraped Instagram posts
The structure of each item in Instagram posts when scrolling looks like this:

{
  "inputUrl": "https://www.instagram.com/humansofny",
  "url": "https://www.instagram.com/p/C3TTthZLoQK/",
  "type": "Image",
  "shortCode": "C3TTthZLoQK",
  "caption": "“Biology gives you a brain. Life turns it into a mind.” Jeffrey Eugenides\n\nCongolese Refugees\n\n#congolese #congo #drc #refugee #refugees #bw #bwphotography #sony #sonyalpha #humanity #mind",
  "hashtags": [],
  "mentions": [],
  "commentsCount": 1,
  "firstComment": "We love your posts blend ! Message us to be featured! 🔥",
  "latestComments": [],
  "dimensionsHeight": 720,
  "dimensionsWidth": 1080,
  "displayUrl": "https://scontent-lga3-2.cdninstagram.com/v/t51.2885-15/426457868_1775839306212473_2684687436495806019_n.jpg?stp=dst-jpg_e35_s1080x1080&_nc_ht=scontent-lga3-2.cdninstagram.com&_nc_cat=105&_nc_ohc=UxY2B6TAloEAX9nHKi1&edm=AP_V10EBAAAA&ccb=7-5&oh=00_AfBSNWqMiaU24y8nOwL5sx-NC7TuvyXB6jzOXhs7oaNvHQ&oe=65D3DB7E&_nc_sid=2999b8",
  "images": [],
  "alt": "Photo shared by Brian René Bergeron on February 13, 2024 tagging @natgeo, @life, @people, @humansofny, @voiceofcongo, @sonyalpha, @congo_on_the_map, and @sony. May be a black-and-white image of 2 people, child and text.",
  "likesCount": 40,
  "timestamp": "2024-02-13T20:49:57.000Z",
  "childPosts": [],
  "ownerFullName": "Brian René Bergeron",
  "ownerUsername": "blend603",
  "ownerId": "5566937141",
},

Scraped Instagram comments
The structure of each item in Instagram comments looks like this:

{
    "id": "17900515570488496",
    "postId": "BwrsO1Bho2N",
    "text": "When is Tesla going to make boats? It was so nice to see clear water in Venice during the covid lockdown!",
    "position": 1,
    "timestamp": "2020-06-07T12:54:20.000Z",
    "ownerId": "5319127183",
    "ownerIsVerified": false,
    "ownerUsername": "mauricepaoletti",
    "ownerProfilePicUrl": "https://scontent-lhr8-1.cdninstagram.com/v/t51.2885-19/s150x150/84630643_482577542360727_932647097444859904_n.jpg?_nc_ht=scontent-lhr8-1.cdninstagram.com&_nc_ohc=B3lQcy6UHX4AX8RjJKN&oh=1df825b662e1f1412eb21fc581c5db75&oe=5F0A760B"
}

Scraped Instagram profile
The structure of each user profile looks like this:

{
    "id": "6622284809",
    "username": "avengers",
    "fullName": "Avengers: Endgame",
    "biography": "Marvel Studios’ \"Avengers​: Endgame” is now playing in theaters.",
    "externalUrl": "http://www.fandango.com/avengersendgame",
    "externalUrlShimmed": "https://l.instagram.com/?u=http%3A%2F%2Fwww.fandango.com%2Favengersendgame&e=ATNWJ4avEN0vwSx1YQCqQqFJst7aAFzINa-BzGZLoTVrdC6sTRTmjM9QNgWKR3URJHMxwg9x",
    "followersCount": 8212505,
    "followsCount": 4,
    "hasChannel": false,
    "highlightReelCount": 3,
    "isBusinessAccount": true,
    "joinedRecently": false,
    "businessCategoryName": "Content & Apps",
    "private": false,
    "verified": true,
    "profilePicUrl": "https://scontent-ort2-2.cdninstagram.com/vp/eaea4675dc1e937f3b449dba21ac3867/5D5DF0E0/t51.2885-19/s150x150/54446499_2222190077828037_3317168817985028096_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
    "profilePicUrlHD": "https://scontent-ort2-2.cdninstagram.com/vp/38a36006532165263f0d82c32de1d0ce/5D767E98/t51.2885-19/s320x320/54446499_2222190077828037_3317168817985028096_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
    "facebookPage": null,
    "igtvVideoCount": 5,
    "latestIgtvVideos": [
        {
            "type": "Video",
            "shortCode": "Bwr3OkpnZZ5",
            "title": "Marvel Studios’ Avengers: Endgame | “Don’t Do It”",
            "caption": "Don’t do it. #DontSpoilTheEndgame",
            "commentsCount": 115,
            "commentsDisabled": false,
            "dimensionsHeight": 1333,
            "dimensionsWidth": 750,
            "displayUrl": "https://scontent-ort2-2.cdninstagram.com/vp/1c063ea4ff0e4768a852411c74470bae/5CCD7FE3/t51.2885-15/e35/58684999_167806787545179_7836940807335402934_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
            "likesCount": 123,
            "videoDuration": 21.688,
            "videoViewCount": 77426
        }
    ],
    "postsCount": 274,
    "latestPosts": [
        {
            "type": "Video",
            "shortCode": "Bw7jACTn3tC",
            "caption": "“We need to take a stand.” Marvel Studios’ #AvengersEndgame is in theaters now. Get tickets: [link in bio]",
            "commentsCount": 1045,
            "dimensionsHeight": 750,
            "dimensionsWidth": 750,
            "displayUrl": "https://scontent-ort2-2.cdninstagram.com/vp/c336cf708e62596cd46879656f86ad70/5CCD112C/t51.2885-15/e35/57649006_653609661751971_8438348841277997450_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
            "likesCount": 142707,
            "videoViewCount": 482810,
            "timestamp": "2019-05-01T18:44:12.000Z",
            "locationName": null
        }
    ],
    "following": [],
    "followedBy": []
}

Scraped Instagram hashtag
The structure of each hashtag detail looks like this:

{
  "id": "17843854051054595",
  "name": "endgame",
  "topPostsOnly": false,
  "profilePicUrl": "https://scontent-ort2-2.cdninstagram.com/vp/c3074c4492e7594fdd330ff8b81cf724/5D558BBC/t51.2885-15/e15/s150x150/58410922_577374706107933_1468173581283089454_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
  "postsCount": 1510549,
  "topPosts": [
    {
      "type": "Image",
      "shortCode": "Bw9UYRrhxfl",
      "caption": "Here is the second part😂😂 Find the first part on the page\nGuess the pictures😏\n-\n-\n-\n#marvel #mcu #dceu #worldofdc #endgame #superhero #superheros #infinitywar #batman #superman #wonderwoman #iroman #captainamerica #thor #thanos #memes #news #dc #dcuniverse #power #funny #fun" "@marvel",
      "hashtags": ["marvel", "mcu", "etc..."],
      "mentions": ["marvel"],
      "commentsCount": 9,
      "dimensionsHeight": 1326,
      "dimensionsWidth": 1080,
      "displayUrl": "https://scontent-ort2-2.cdninstagram.com/vp/4d67498d0bc033cbfdf8b666d0fce6d1/5D629B3E/t51.2885-15/e35/57216878_2119889691397544_8022105877563047858_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
      "likesCount": 2342,
      "timestamp": "2019-05-02T11:14:55.000Z",
      "locationName": null
    }
  ],
  "latestPosts": [
    {
      "type": "Sidecar",
      "shortCode": "Bw9flNKl56O",
      "caption": "Mínimo lo se mi tributo a semejante peli pero bue algo quería hacer me llore la vidaaaaa #endgame #avengersendgame #avengers #thanos #ironman #hulk #thor #makeupcomic #makeup #moviemakeup #makeupeyes #makeupfantasy #makeupavengers #makeuphero",
      "commentsCount": 0,
      "dimensionsHeight": 936,
      "dimensionsWidth": 1080,
      "displayUrl": "https://scontent-ort2-2.cdninstagram.com/vp/d97b7e434dbbb4141552c9af9c8fb05b/5D5F34FD/t51.2885-15/e35/58087917_2268263940082789_7711745336102849043_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
      "likesCount": 12312,
      "timestamp": "2019-05-02T12:52:48.000Z",
      "locationName": null
    }
  ]
}

Scraped Instagram place
The structure of each place detail looks like this:

{
    "#debug": {
        "url": "https://www.instagram.com/explore/locations/1017812091/namesti-miru/"
    },
    "id": "1017812091",
    "name": "Náměstí Míru",
    "public": true,
    "lat": 50.0753325,
    "lng": 14.43769,
    "slug": "namesti-miru",
    "description": "",
    "website": "",
    "phone": "",
    "aliasOnFacebook": "",
    "addressStreetAddress": "",
    "addressZipCode": "",
    "addressCityName": "Prague, Czech Republic",
    "addressRegionName": "",
    "addressCountryCode": "CZ",
    "addressExactCityMatch": false,
    "addressExactRegionMatch": false,
    "addressExactCountryMatch": false,
    "profilePicUrl": "https://scontent-ort2-2.cdninstagram.com/vp/aa8cc8c627cbddf3df270747223f5f23/5D68CDEA/t51.2885-15/e35/s150x150/57561454_2452560724777787_307886881124344332_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
    "postsCount": 5310,
    "topPosts": [
        {
            "type": "Image",
            "shortCode": "Bw6lVVZhXXB",
            "caption": "🦋🦋🦋",
            "commentsCount": 3,
            "dimensionsHeight": 750,
            "dimensionsWidth": 750,
            "displayUrl": "https://scontent-ort2-2.cdninstagram.com/vp/03de7e9343f98fdf47513a0a944c427f/5D6656A8/t51.2885-15/e35/57561454_2452560724777787_307886881124344332_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
            "likesCount": 345,
            "timestamp": "2019-05-01T09:45:20.000Z",
            "locationName": null
        }
    ],
    "latestPosts": [
        {
            "type": "Image",
            "shortCode": "Bw9KSlIhAc-",
            "caption": "#vinohradskaprincezna #nekdotomusikontrolovat #jestezememaji #jmenujusebufinka 🐶",
            "commentsCount": 0,
            "dimensionsHeight": 1080,
            "dimensionsWidth": 1080,
            "displayUrl": "https://scontent-ort2-2.cdninstagram.com/vp/0fa17a87dee94c0c63c8973c6c0677eb/5D59EE21/t51.2885-15/e35/57506136_399700847249384_6385808161520210872_n.jpg?_nc_ht=scontent-ort2-2.cdninstagram.com",
            "likesCount": 4546,
            "timestamp": "2019-05-02T09:46:45.000Z",
            "locationName": null
        }
    ]
}

Scraped Instagram post details
The structure of each post detail looks like this:

{
    "type": "Sidecar",
    "shortCode": "BwrsO1Bho2N",
    "caption": "Newly upgraded Model S and X drive units rolling down the production line at Gigafactory 1 #tesla #model3 @elonmusk",
    "hashtags": ["tesla", "model3"],
    "mentions": ["elonmusk"],
    "position": 1,
    "url": "https://www.instagram.com/p/BwrsO1Bho2N",
    "commentsCount": 711,
    "latestComments": [
        {
            "ownerUsername": "mauricepaoletti",
            "text": "When is Tesla going to make boats? It was so nice to see clear water in Venice during the covid lockdown!"
        }
    ],
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fist4-1.fna.fbcdn.net/v/t51.2885-15/e35/57840129_308705413159630_8358160330083042716_n.jpg?_nc_ht=instagram.fist4-1.fna.fbcdn.net&_nc_cat=110&_nc_ohc=g7JIBg70oHMAX_QGayb&oh=1402875349a6d1cd8693f14f2b617fd6&oe=5F0DBA1F",
    "id": "2029910590113615245",
    "firstComment": "@miszdivastatuz",
    "likesCount": 153786,
    "timestamp": "2019-04-25T14:57:01.000Z",
    "locationName": "Tesla Gigafactory 1",
    "locationId": "2172837629656184",
    "ownerFullName": "Tesla",
    "ownerUsername": "teslamotors",
    "ownerId": "297604134",
    "captionIsEdited": false,
    "hasRankedComments": false,
    "commentsDisabled": false,
    "displayResourceUrls": [
        "https://instagram.fist4-1.fna.fbcdn.net/v/t51.2885-15/e35/57840129_308705413159630_8358160330083042716_n.jpg?_nc_ht=instagram.fist4-1.fna.fbcdn.net&_nc_cat=110&_nc_ohc=g7JIBg70oHMAX_QGayb&oh=1402875349a6d1cd8693f14f2b617fd6&oe=5F0DBA1F",
        "https://instagram.fist4-1.fna.fbcdn.net/v/t51.2885-15/e35/56744724_532173877312018_171181625703519178_n.jpg?_nc_ht=instagram.fist4-1.fna.fbcdn.net&_nc_cat=110&_nc_ohc=_zTxcKu_hyYAX9KtDax&oh=175f7e2fceb3f6b20f84e148baf4d9f9&oe=5F0C7535"
    ],
    "childPosts": [],
    "locationSlug": "tesla-gigafactory-1",
    "isAdvertisement": false,
    "taggedUsers": [],
    "likedBy": []
}

FAQ
Can I scrape data from both Instagram and Threads at the same time?
Since Instagram and Threads share userbase, you can scrape both Threads and Instagram profiles since they share the same usernames. By using scraping techniques, you can extract data from both platforms simultaneously and get insights into user profiles and their activities on both Meta platforms. You may want to check out our Threads Profile Scraper as well.

Integrations and Instagram Scraper
Last but not least, Instagram Scraper can be connected with almost any cloud service or web app thanks to integrations on the Apify platform. You can integrate with Make, Zapier, Slack, Airbyte, GitHub, Google Sheets, Google Drive, and more. Or you can use webhooks to carry out an action whenever an event occurs, e.g. get a notification whenever Instagram Scraper successfully finishes a run.

Using Instagram Scraper with the Apify API
The Apify API gives you programmatic access to the Apify platform. The API is organized around RESTful HTTP endpoints that enable you to manage, schedule, and run Apify actors. The API also lets you access any datasets, monitor actor performance, fetch results, create and update versions, and more.

To access the API using Node.js, use the apify-client NPM package. To access the API using Python, use the apify-client PyPI package.

Check out the Apify API reference docs for full details or click on the API tab for code examples.

Description


JSON Example

Instagram URLs you want to scrape

directUrls

Optional

Add one or more Instagram URLs to scrape. The field is optional, but you need to either use this field or search query below.

Type:
array
What do you want to scrape from each page?

resultsType

Optional

You can choose to get posts, comments or details from Instagram URLs. Comments can only be scraped from post URLs.
❗Please note that the stories type has been deprecated. It used to return reels data, which wasn’t aligned with its purpose. Please use reels instead.

Type:
string
Default:
posts
Options:
posts
comments
details
mentions
reels
stories
Max results per URL

resultsLimit

Optional

How many posts or comments (max 50 comments per post) you want to scrape from each Instagram URL. If you set this to 1, you will get a single post from each page.

Type:
integer
Minimum:
1
Newer than

onlyPostsNewerThan

Optional

Limit how far back to the history the scraper should go. The date should be in YYYY-MM-DD or full ISO absolute format or in relative format e.g. 1 days, 2 months, 3 years. All time values are taken in UTC timezone

Type:
string
Search query

search

Optional

Provide a search query which will be used to search Instagram for profiles, hashtags or places.

Type:
string
Search type

searchType

Optional

What type of pages to search for (you can look for hashtags, profiles or places).

Type:
string
Default:
hashtag
Options:
user
hashtag
place
Search results limit

searchLimit

Optional

How many search results (hashtags, users or places) should be returned.

Type:
integer
Minimum:
1
Maximum:
250
Add metadata

addParentData

Optional

Only for feed items - add data source to results, i.e. for profile posts metadata is profile, for tag posts metadata is hashtag

Type:
boolean
Default:
false

EXAMPLE scrape from a post:

#
Alt
alt
Caption
caption
Child Posts
childPosts
Comments Count
commentsCount
Dimensions Height
dimensionsHeight
Dimensions Width
dimensionsWidth
Display URL
displayUrl
First Comment
firstComment
Hashtags
hashtags
ID
id
Images
images
Input URL
inputUrl
Is Comments Disabled
isCommentsDisabled
Latest Comments
latestComments
Likes Count
likesCount
Mentions
mentions
Owner Full Name
ownerFullName
Owner ID
ownerId
Owner Username
ownerUsername
Short Code
shortCode
Timestamp
timestamp
Type
type
URL
url
1
Photo by Europe Travel Guide 🇪🇺 Hotels | Attractions | Tips on December 14, 2025. May be an image of Piazza di Spagna, the Tiber River, the Arno River and text.
The 10 must-see places in Rome. The Eternal City is full of great attractions. Here are 10 must-visit places. Piazza Navona: This historic square is home to three famous fountains, each decorated with sculptures and water jets. It is surrounded by many lively restaurants and bars, offering a breathtaking view of the square's baroque architecture. Piazza di Spagna: This square, famous for the steps of the Trinità dei Monti, is the perfect place to relax and admire the architecture. It is also surrounded by luxury stores and high-end restaurants. Castel Sant'Angelo: This fortress built in the 2nd century has been transformed into a museum dedicated to the history of Rome. Basilica San Pietro: This basilica is the largest religious building in the world and also houses the incredible Vatican Museum. Colosseum: This emblematic monument, built in the first century, is one of the most famous symbols of Rome. It bears witness to the past grandeur of the Roman Empire. Fontana dell'Acqua Paola: This fountain built in the early 18th century is one of the most charming monuments in Rome. Piazza del Popolo: This large square in the center of Rome is surrounded by historic buildings and fountains. It is a popular meeting point for the inhabitants of Rome and tourists. Altare della Patria: This monumental building is a symbol of Italian unity. It houses a museum dedicated to the history of modern Italy. Fontana di Trevi: This famous baroque fountain is one of the most photographed sites in Rome. According to legend, if you throw a coin in the fountain you will return to Rome one day. Pantheon: This historic building is considered one of the greatest examples of ancient Roman architecture. It also houses the tombs of several Italian kings and famous artists. Share with a friend who loves Italy Great pictures by @manutoni24 #RomeItaly #EternalCity #CityOfHistory #VaticanCity #PiazzaNavona #PiazzaDiSpagna #CastelSantAngelo #BasilicaSanPietro #ColosseumRome #AcquaPaola #PiazzaDelPopolo #AltareDellaPatria #FontanaDiTrevi #PantheonRome #SPQR
10 items
36
937
750
Proxied content	
😍👏😍
15 items
3787561672689983318
10 items
https://www.instagram.com/p/DSQH0Yhkh9W/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==		
10 items
4056
1 item
Europe Travel Guide 🇪🇺 Hotels | Attractions | Tips
4241080677
bestcitiesofeurope
DSQH0Yhkh9W
2025-12-14 17:16:06 UTC
Sidecar
https://www.instagram.com/p/DSQH0Yhkh9W/

API

API token
Default API token created on sign up.


Manage tokens
List of most relevant API endpoints. See API reference for full details.
The URLs below contain your API token. Don't share them with untrusted parties.
Run Actor
View API reference
Runs this Actor. The POST payload including its Content-Type header is passed as INPUT to the Actor (typically application/json). The Actor is started with the default options; you can override them using various URL query parameters.

POST
https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=***


Hint: By adding the method=POST query parameter, this API endpoint can be called using a GET request and thus used in third-party webhooks.

Run Actor synchronously and get a key-value store record
View API reference
Runs this Actor and waits for it to finish. The POST payload, including its Content-Type, is passed as Actor input. The OUTPUT record (or any other specified with the outputRecordKey query parameter) from the default key-value store is returned as the HTTP response. The Actor is started with the default options; you can override them using various URL query parameters. Note that long HTTP connections might break.

POST
https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync?token=***


Hint: This endpoint can be used with both POST and GET request methods, but only the POST method allows you to pass input.

Run Actor synchronously and get dataset items
View API reference
Runs this Actor and waits for it to finish. The POST payload including its Content-Type header is passed as INPUT to the Actor (usually application/json). The HTTP response contains the Actor's dataset items, while the format of items depends on specifying dataset items' format parameter.

POST
https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=***


Hint: This endpoint can be used with both POST and GET request methods, but only the POST method allows you to pass input.

Get Actor
View API reference
Returns settings of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/apify~instagram-scraper?token=***



Test endpoint

Get a list of Actor versions
View API reference
Returns a list of versions of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/apify~instagram-scraper/versions?token=***



Test endpoint

Get a list of Actor webhooks
View API reference
Returns a list of webhooks of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/apify~instagram-scraper/webhooks?token=***



Test endpoint

Update Actor
View API reference
Updates settings of this Actor. The POST payload must be a JSON object with fields to update.

PUT
https://api.apify.com/v2/acts/apify~instagram-scraper?token=***


Update Actor version
View API reference
Updates version of this Actor. Replace the 0.0 with the updating version number. The POST payload must be a JSON object with fields to update.

PUT
https://api.apify.com/v2/acts/apify~instagram-scraper/versions/0.0?token=***


Delete Actor
View API reference
Deletes this Actor and all associated data.

DELETE
https://api.apify.com/v2/acts/apify~instagram-scraper?token=***


Get a list of builds
View API reference
Returns a list of builds of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/apify~instagram-scraper/builds?token=***



Test endpoint

Build Actor
View API reference
Builds a specific version of this Actor and returns information about the build. Replace the 0.0 parameter with the desired version number.

POST
https://api.apify.com/v2/acts/apify~instagram-scraper/builds?token=***&version=0.0


Hint: By adding the method=POST query parameter, this API endpoint can be called using a GET request and thus used in third-party webhooks.

Get a list of runs
View API reference
Returns a list of runs of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=***



Test endpoint

Get last run
View API reference
Returns the last run of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/apify~instagram-scraper/runs/last?token=***



Test endpoint

Hint: Add the status=SUCCEEDED query parameter to only get the last successful run of the Actor.

Get last run dataset items
View API reference
Returns data from the default dataset of the last run of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/apify~instagram-scraper/runs/last/dataset/items?token=***



Test endpoint

Hint: Add the status=SUCCEEDED query parameter to only get the last successful run of the Actor. This API endpoint supports all the parameters of the Dataset Get Items endpoint.

Get OpenAPI definition
View API reference
Returns the OpenAPI definition for the Actor's default build with information on how to run this Actor build using the API.

GET
https://api.apify.com/v2/acts/apify~instagram-scraper/builds/default/openapi.json