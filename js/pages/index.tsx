import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button, Col, Row } from "antd";
import Head from 'next/head'
import {Accordion} from 'react-bootstrap'


const Home: NextPage = () => {
    // const [active, setActive] = useState(false);
    // const contentRef = useRef(null);
    //
    // useEffect(() => {
    // contentRef.current.style.display = active
    //   ? "block"
    //   : "none";
    // }, [contentRef, active]);
    //
    // const toggleAccordion = () => {
    // setActive(!active);
    // };
    return (
        <div className={styles.container}>
            <Head>
                <title>Extend</title>
                <link rel="icon" href="/images/small_logo.svg" />
                <link rel="apple-touch-icon" href="/images/small_logo.svg" />
                <meta name="description" content="Extend your world with Spaces" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>
            <section className={`${styles.logoAndSocial}`}>
            <Row>
            <Col  xs={24} sm={24} md={12} lg={12} xl={11}>
                                <img src={"/images/logo.svg"} className={styles.logoImage} height={48}/>
            </Col >
            <Col  xs={24} sm={24} md={12} lg={12} xl={11}>
            <Row className={styles.socialMediaBar}>
                        {/* <img src={"/images/twitter.svg"} className={styles.socialMediaButton}/> */}
                        <a href="https://t.me/ExtendOfficial" className={styles.socialMediaButton}>
                        <img src={"/images/social/telegram.svg"} className={styles.socialMediaLogo}/>
                        </a>
                        <a href="https://discord.gg/sjdNRwtJDy" className={styles.socialMediaButton}>
                        <img src={"/images/social/discord.svg"} className={styles.socialMediaLogo}/>
                        </a>
                        <a href="https://twitter.com/ExtendXYZ" className={styles.socialMediaButton}>
                        <img src={"/images/social/twitter.svg"} className={styles.socialMediaLogo}/>
                        </a>
                        <a href="https://www.instagram.com/extendxyz/" className={styles.socialMediaButton}>
                        <img src={"/images/social/instagram.png"} className={styles.socialMediaLogo}/>
                        </a>
                        <a href="https://medium.com/@Extend" className={styles.socialMediaButton}>
                        <img src={"/images/social/medium.svg"} className={styles.socialMediaLogo}/>
                        </a>
                        <a href="https://github.com/ExtendXYZ/extend-official" className={styles.socialMediaButton}>
                        <img src={"/images/social/github.png"} className={styles.socialMediaLogo}/>
                        </a>
                        <a href="https://canvas.extend.xyz/"><Button className={styles.launchAppButton}>App</Button></a>
                        </Row>
            </Col>
            </Row>
            </section>
            <section className={`${styles.sectionHeader}`}>
                <Row>
                    <Col xs={24} sm={24} md={12} lg={12} xl={11} className={styles.headerSectionContent}>
                        {/* <div className={`${styles.logoContainer} ${styles.logo}`}> */}
                        {/* <Row>
                            <Col xs={24} sm={24} md={12}>
                                <img src={"/images/logo.svg"} className={styles.logoImage} height={48}/>
                            </Col>
                        </Row> */}
                        {/* </div> */}
                        <div>
                            <h1 className={`main-title ${styles.mainTitle}`}>Extend your world with Spaces</h1>
                            <p className={styles.headerText}>
                                Extend NFTs into a new dimension.
                                Extend evokes that shift from static jpg to dynamic utility...
                                from a profile picture flex to a living artifact of culture and community.
                                You are in charge of where the future takes us.
                            </p>
                            <a href="https://canvas.extend.xyz/mint"><Button  className={`big-button ${styles.borderRadiusButton}`}  size={'middle'}>Mint your Space now</Button><br /></a>
                        </div>
                        <div />
                    </Col>
                    <Col className={styles.titleImageContainer} xs={24} sm={24} md={12} lg={12} xl={13}>
                    </Col>
                </Row>
            </section>
            <section className={`${styles.sectionMain} `}>
                <Row className={styles.sectionReverse}>
                    <Col className={styles.spaceImageContainer} sm={24} md={11} lg={11} xl={10}>
                    </Col>
                    <Col sm={24} md={13} lg={13} xl={11} className={`${styles.sectionContent} ${styles.spaceContent}`}>
                        <h1>Collect Spaces</h1>
                        <p>
                            A million Spaces will be minted on the blazing fast Solana network, the largest NFT mint
                            to date. Mint a single Space or collect a whole neighborhood right from the canvas.
                        </p>
                        <div>
                            <a href="https://canvas.extend.xyz"><Button className={styles.borderRadiusButton} size={'middle'}>Collect yours now</Button></a>
                        </div>
                    </Col>
                </Row>
            </section>
            <section className={`${styles.sectionHeader}`}>
                <Row>
                    <Col sm={24} xs={24} md={15} lg={14} xl={11} className={styles.sectionContent}>
                        <h1>Extend your Spaces</h1>
                        <p>
                            Spaces are programmable. To start, each Space can be registered on our 1000 x 1000 Canvas
                            and gives the Space owner the ability to modify the color of a single pixel.
                            Imagine what’s possible with a little coordination!
                            <br/>
                            <br/>
                            Extend is open to developers and new experiences will continue to be added.
                            Each Space is minted with an X and Y coordinate. The Z is left to you, the creators.
                        </p>
                    </Col>
                    <Col sm={24}  xs={24} md={9} lg={10} xl={13} className={styles.extendsImageContainer}>
                    </Col>
                </Row>
            </section>
            <section className={`${styles.sectionMain} ${styles.sectionNotMargin}`}>
                <Row justify={"center"}>
                    <Col md={24} className={styles.extendSection}>
                        <h1>See the first layer built on Extend.</h1>
                        <p>
                            We’ve built a Canvas to display your unique Spaces.<br />
                            Buy, sell, and customize to your heart’s content.
                        </p>
                        <a href="https://canvas.extend.xyz"><Button className={`${styles.borderRadiusButton} ${styles.browseTheMapButton}`}>Browse the Canvas</Button></a>

                        <img className={styles.cuceImage} src={"/images/cuce.png"} />
                    </Col>
                </Row>
            </section>
            <section>
                <Row className={styles.roadMapBackground}>
                        <img src={"/images/road_map_detail.png"}/>
                </Row>
            </section>
            {/* <section className={`${styles.sectionMain} ${styles.roadMap}`}>
                <Row>
                    <Col sm={24} md={16} className={styles.roadMapContent}>
                        <h1>Roadmap</h1>

                        <h2>Genesis neighborhood</h2>
                        <p>Mint a Space in our first public neighborhood. Choose a color or upload an image over many pixels.
                            Mint an individual Space or accumulate a larger region.</p>

                        <h2>The journey to 1 million</h2>
                        <p>Expand to 1 million NFTs. The biggest NFT launch on Solana ever. 10% of the total NFT supply of Solana!
                        </p>

                        <h2>Renting Spaces</h2>
                        <p>Enable rent to facilitate larger, coherent displays without giving up ownership.</p>

                        <h2>Infiniland</h2>
                        <p>The universe is infinite, Spaces should be too. Enable exploration of neighborhoods
                            beyond the original 1 million. Explorers will manage their own neighborhoods (mint,
                            distribution, etc.).
                        </p>

                        <h2>Extend to more layers</h2>
                        <p>Spaces become the new standard for NFTs on Solana, programmed to be anything you’d like.
                            Create art. Play games. Build the Metaverse. The only limit is your imagination.</p>
                    </Col>
                </Row>
            </section> */}
            <section className={`${styles.sectionMain}`}>
                <Row>
                    <Col sm={24} md={16} className={styles.roadMapContent}>
                        <h1>FAQs</h1>
                        <h2>Mint</h2>
                        <Accordion flush>
                          <Accordion.Item eventKey="0" className={styles.accordionItem}>
                            <Accordion.Header>Wen mint?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Check our Discord and Twitter for public mint times
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="1" className={styles.accordionItem}>
                            <Accordion.Header>How do I mint a Space?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                1. Connect your wallet.<br/>
                                2. Select the amount of Spaces you would like to <a href="https://canvas.extend.xyz/mint">
                                mint</a> and click “Get Vouchers”
                                to receive your Space voucher tokens.<br/>
                                3. Solve the captcha correctly.<br/>
                                4. Select the number of tokens you’d like to redeem and turn in your Space
                                voucher tokens to mint your Space. Each Space requires one
                                voucher token and about 0.014 SOL, so be sure to budget for that fixed cost!
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="2" className={styles.accordionItem}>
                            <Accordion.Header>What? Why is there a captcha?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                            We do not believe users with bots are entitled to unlimited minting. The captcha
                                prevents botting and is our “proof of human work.”
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="3" className={styles.accordionItem}>
                            <Accordion.Header>I hate captchas and want to mint a lot, what can I do?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                            For minters who want the convenience of minting a larger batch of voucher tokens,
                                we have come up with pricing to allow that. The price for a single
                                voucher token is 0 SOL and for 10 voucher tokens is 0.1 SOL. Note that there is a
                                cap on the number of tokens in a single transaction to 100 (~1.85 SOL).
                            </Accordion.Body>
                          </Accordion.Item>
                        </Accordion>
                        <br/>
                        <h2>Using the Canvas</h2>
                        <Accordion flush>
                          <Accordion.Item eventKey="0" className={styles.accordionItem}>
                            <Accordion.Header>Why can’t I change the color of my Space?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Make sure that your wallet is connected and that the Spaces have been registered (click the
                                “Register” button after connecting your wallet).
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="1" className={styles.accordionItem}>
                            <Accordion.Header>How do I upload an image?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Simply press shift, click and drag. The interface will then allow you to upload an image
                                (or a gif for animations!), only the pixels corresponding to owned Spaces will change.
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="2" className={styles.accordionItem}>
                            <Accordion.Header>Why can’t I buy my neighbor’s Space?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                            By default a Space is not listed. Your neighbor needs to register the Space in question
                                    and list it for sale.
                            </Accordion.Body>
                          </Accordion.Item>
                        </Accordion>
                        <br/>
                        <h2>General</h2>
                        <Accordion flush>
                          <Accordion.Item eventKey="0" className={styles.accordionItem}>
                            <Accordion.Header>What is Extend?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Extend is building the next generation of NFT, Spaces. Each Space represents ownership of
                                coordinates (x,y) which can be extended to participate in new application
                                layers. The Canvas is just the first layer.
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="1" className={styles.accordionItem}>
                            <Accordion.Header>How can I participate?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                - Buy SOL: available on Coinbase, FTX, etc... <br/>
                                - Transfer / withdraw SOL to your Phantom Wallet to interact with the website. <a href="https://phantom.app/help/installing-phantom">
                                How to setup a Phantom wallet</a><br/>
                                - Follow the mint instructions under “How do I mint a Space?”.
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="2" className={styles.accordionItem}>
                            <Accordion.Header>Why Solana?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Solana is the most efficient blockchain available right now. A project of this magnitude
                                would be prohibitively expensive on Ethereum.
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="3" className={styles.accordionItem}>
                            <Accordion.Header>1 million NFTs? Aren’t you killing the environment?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Based on the <a href="https://solana.com/news/solana-energy-usage-report-november-2021">most
                                recent (Nov 2021) energy usage report</a> on Solana, each transaction uses
                                1,837 J, which is less than the energy usage of two Google searches and 0.000265 percent of the
                                equivalent cost for an Ethereum transaction. To put that into perspective, minting one million
                                Spaces uses less energy than minting an Ethereum collection of size 3.
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="4" className={styles.accordionItem}>
                            <Accordion.Header>Wen decentralized?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                - Actions taken on the website send transactions directly to the blockchain.<br/>
                                - When you connect to our website, your browser reads the state directly from the blockchain.<br/>
                                - No intermediaries!
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="5" className={styles.accordionItem}>
                            <Accordion.Header>Wen utility?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Initially, Space owners will be able to: <br/>
                                - Change the color of the corresponding Canvas pixel<br/>
                                - Add animations<br/>
                                - Buy and sell their Spaces<br/>
                                - Upload images and gifs to span multiple pixels<br/>
                                Check the roadmap for planned features.
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="6" className={styles.accordionItem}>
                            <Accordion.Header>What’s the creator (royalty) fee?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Zero, we are committed to the lowest transaction costs possible and we view you, the Space
                                owners, as the creators.
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="7" className={styles.accordionItem}>
                            <Accordion.Header>What’s the marketplace fee?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                One percent, full proceeds go to the Extend DAO and will be used for future development.
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="8" className={styles.accordionItem}>
                            <Accordion.Header>What happens to the convenience fees?</Accordion.Header>
                            <Accordion.Body style={{backgroundColor: "black"}}>
                                Any convenience fees collected will go to the Extend DAO.
                            </Accordion.Body>
                          </Accordion.Item>
                        </Accordion>
                    </Col>
                </Row>
            </section>
        </div>

    )
}

export default Home
