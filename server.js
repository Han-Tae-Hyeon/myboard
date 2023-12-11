// Express, Session, Multer, SHA-256 해싱, 그리고 MongoDB 모듈들을 가져옵니다.
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const sha = require("sha256");
const { MongoClient, ObjectId } = require("mongodb");

// Express 애플리케이션을 생성합니다.
const app = express();
const port = 3000;

// MongoDB 연결 정보를 담은 URL
const url = "mongodb+srv://phixia0:uduseal15@cluster0.u0hmg3n.mongodb.net/?retryWrites=true&w=majority";
let mydb; // MongoDB 데이터베이스 인스턴스

// MongoDB에 연결합니다.
MongoClient.connect(url)
    .then((client) => {
        mydb = client.db("myboard"); // "myboard" 데이터베이스에 연결합니다.
        app.listen(port, function () {
            console.log(`서버가 ${port} 포트에서 대기 중...`);
        });
    })
    .catch((err) => {
        console.error(err);
    });

// Multer를 사용하여 파일 업로드를 위한 설정입니다.
const storage = multer.diskStorage({
    destination: function (req, file, done) {
        done(null, "./public/image"); // 업로드된 파일을 "./public/image" 디렉토리에 저장합니다.
    },
    filename: function (req, file, done) {
        done(null, file.originalname); // 업로드된 파일에 대해 원래의 파일 이름을 사용합니다.
    }
});


// Multer 미들웨어를 등록합니다.
const upload = multer({ storage: storage });

// Body parser 미들웨어로 폼 데이터를 파싱합니다.
app.use(express.urlencoded({ extended: true }));

// EJS(view engine) 설정
app.set("view-engine", "ejs");
app.use(express.static("public")); // "public" 디렉토리에서 정적 파일을 제공합니다.

// Session 설정
app.use(
    session({
        secret: "asdjiqweo123123", // 세션 데이터를 암호화하는 데 사용되는 비밀 키
        resave: false,
        saveUninitialized: true,
    })
);

// 루트 페이지 라우트
app.get("/", function (req, res) {
    res.render("index.ejs", { user: req.session.user || null }); // 사용자 세션 데이터를 포함하여 index 페이지를 렌더링합니다.
});

// 게시글 목록 페이지 라우트
app.get("/postlist", async function (req, res) {
    try {
        if (req.session.user) {
            const userId = req.session.user.userid;
            const friendIds = await getUserAndFriendIds(userId);

            // 현재 사용자와 그 친구들을 위한 게시물을 가져옵니다.
            const posts = await mydb
                .collection("post")
                .find({
                    writer: { $in: [userId, ...friendIds] },
                })
                .toArray();

            // 게시물 데이터, 사용자 세션 및 친구 데이터를 포함하여 postlist 페이지를 렌더링합니다.
            res.render("postlist.ejs", {
                data: posts,
                user: req.session.user,
                friendsData: { friends: friendIds },
            });
        } else {
            res.render("login.ejs"); // 사용자 세션이 없으면 로그인 페이지로 이동합니다.
        }
    } catch (error) {
        console.error(`게시글 목록 조회 중 오류 발생: ${error}`);
        res.status(500).send("Internal Server Error");
    }
});

// 게시글 작성 페이지 라우트
app.get("/entermongo", function (req, res) {
    if (req.session.user) {
        console.log("세션 유지");
        res.render("enter.ejs"); // 세션이 유지되면 게시글 작성 페이지를 렌더링합니다.
    } else {
        res.render("login.ejs"); // 사용자 세션이 없으면 로그인 페이지로 이동합니다.
    }
});

// 게시글 내용 조회 페이지 라우트
app.get("/content/:id", function (req, res) {
    console.log(req.params.id);
    let new_id = new ObjectId(req.params.id);

    // 특정 게시물의 내용을 가져오고 내용 페이지를 렌더링합니다.
    mydb.collection("post")
        .findOne({ _id: new_id })
        .then((result) => {
            console.log(result);
            res.render("content.ejs", { data: result });
        })
        .catch((err) => {
            console.error("err");
            res.status(500).send();
        });
});

// 게시글 수정 페이지 라우트
app.get("/edit/:id", function (req, res) {
    console.log(req.params.id);
    let new_id = new ObjectId(req.params.id);

    // 특정 게시물을 수정하기 위해 해당 게시물의 내용을 가져오고 수정 페이지를 렌더링합니다.
    mydb.collection("post")
        .findOne({ _id: new_id })
        .then((result) => {
            console.log(result);
            res.render("edit.ejs", { data: result });
        })
        .catch((err) => {
            console.error("err");
            res.status(500).send();
        });
});

// 로그인 페이지 라우트
app.get("/login", function (req, res) {
    console.log(req.session);
    if (req.session.user) {
        console.log("세션 유지");
        res.render("index.ejs", { user: req.session.user });
    } else {
        res.render("login.ejs");
    }
});

// 로그인 처리 라우트
app.post("/login", function (req, res) {
    console.log("아이디 : " + req.body.userid);
    console.log("비밀번호 : " + req.body.userpw);

    // 로그인 자격을 확인하고 성공 시 사용자 세션을 설정합니다.
    mydb.collection("account")
        .findOne({ userid: req.body.userid })
        .then((result) => {
            if (result.userpw == sha(req.body.userpw)) {
                req.session.user = req.body;
                console.log("새로운 로그인");
                res.render("index.ejs", { user: req.session.user });
            } else {
                res.render("index.ejs");
            }
        });
});

// 로그아웃 처리 라우트
app.get("/logout", function (req, res) {
    console.log("로그아웃");
    req.session.destroy(); // 세션을 파괴하여 로그아웃합니다.
    res.render("index.ejs", { user: null });
});

// 회원가입 페이지 라우트
app.get("/signup", function (req, res) {
    res.render("signup.ejs");
});

// 회원가입 처리 라우트
app.post('/signup', function(req, res){
    // 요청 본문(body)에서 전달된 사용자 정보를 서버 콘솔에 출력
    console.log(req.body);

    // "account" 컬렉션에 새로운 사용자 정보를 삽입
    mydb.collection('account').insertOne({
        userid: req.body.userid,          // 사용자 ID
        userpw: sha(req.body.userpw),     // 암호화된 사용자 비밀번호
        usergroup: req.body.usergroup,    // 사용자 그룹
        useremail: req.body.email         // 이메일 정보
    })
    .then(result => {
        // 삽입 결과를 서버 콘솔에 출력
        console.log(result);
        // 회원가입이 성공했음을 서버 콘솔에 출력
        console.log('회원가입 성공');
    });

    // 클라이언트를 홈페이지로 리다이렉트
    res.redirect('/');
});



app.post('/photo', upload.single('picture'), function(req, res){
    let imagepath = '/' + req.file.path.replace(/\\/g, '/').slice('/public'.length);
    console.log(imagepath);

    // 'photo' 라우트에서 이미지를 업로드한 경우에만 처리하도록 변경
    if (req.file) {
        // 이미지 경로를 세션에 저장
        req.session.imagepath = imagepath;
    }
});

app.post("/savepost", upload.single("picture"), function (req, res) {
    let now = new Date();
    console.log(req.body.title);
    console.log(req.body.content);

    // 세션에 저장된 이미지 경로를 가져옴
    let imagepath = req.session.imagepath || null;

    // 게시물을 데이터베이스에 추가합니다.
    mydb.collection("post")
        .insertOne({
            writer: req.session.user.userid,
            title: req.body.title,
            content: req.body.content,
            date: now.getTime(),
            path: imagepath, // 업로드된 사진의 경로를 포함합니다.
        })
        .then((result) => {
            console.log(result);
            console.log("데이터 추가 성공");

            // 세션에서 이미지 경로 제거
            delete req.session.imagepath;

            res.redirect("/postlist");
        })
        .catch((error) => {
            console.error("데이터 추가 중 오류 발생:", error);
            res.status(500).send("Internal Server Error");
        });
});


// 게시글 삭제 처리 라우트
app.delete("/delete/:id", function (req, res) {
    // 클라이언트에서 전달된 게시글 ID를 파라미터에서 추출합니다.
    const postId = req.params.id;

    // 현재 세션에서 사용자 정보를 확인합니다.
    if (req.session.user) {
        // 현재 사용자의 ID를 추출합니다.
        const userId = req.session.user.userid;

        // 게시물을 삭제합니다. 삭제 권한이 있는지 확인합니다.
        mydb.collection("post")
            .findOne({ _id: new ObjectId(postId), writer: userId })
            .then((result) => {
                // 삭제 권한이 있는 경우
                if (result) {
                    // "post" 컬렉션에서 해당 게시글을 삭제합니다.
                    mydb.collection("post")
                        .deleteOne({ _id: new ObjectId(postId) })
                        .then(() => {
                            // 삭제가 완료되면 서버 콘솔에 메시지를 출력하고 클라이언트에게 성공 상태 코드를 반환합니다.
                            console.log("삭제완료");
                            res.status(200).send();
                        })
                        .catch((err) => {
                            // 삭제 중 오류가 발생하면 서버 콘솔에 오류를 출력하고 클라이언트에게 500 상태 코드를 반환합니다.
                            console.error("게시글 삭제 중 오류 발생:", err);
                            res.status(500).send();
                        });
                } else {
                    // 삭제 권한이 없는 경우 서버 콘솔에 메시지를 출력하고 클라이언트에게 403 상태 코드를 반환합니다.
                    console.log("삭제 권한이 없습니다.");
                    res.status(403).send("Forbidden");
                }
            })
            .catch((err) => {
                // 게시글 조회 중 오류가 발생하면 서버 콘솔에 오류를 출력하고 클라이언트에게 500 상태 코드를 반환합니다.
                console.error("게시글 조회 중 오류 발생:", err);
                res.status(500).send();
            });
    } else {
        // 사용자가 로그인하지 않은 경우 서버 콘솔에 메시지를 출력하고 클라이언트에게 401 상태 코드를 반환합니다.
        console.log("로그인이 필요합니다.");
        res.status(401).send("Unauthorized");
    }
});

// 게시글 수정 처리 라우트
app.post("/edit", function (req, res) {
    console.log(req.body.title);
    console.log(req.body.content);
    let new_id = new ObjectId(req.body.id);

    // 게시물을 수정합니다.
    mydb.collection("post")
        .updateOne(
            { _id: new_id },
            { $set: { title: req.body.title, content: req.body.content, date: req.body.someDate } }
        )
        .then((result) => {
            console.log(result);
            console.log("데이터 수정 성공");
            res.redirect("/postlist");
        });
});

// 친구 목록 페이지 라우트
app.get("/friend", function (req, res) {
    // 현재 세션에서 사용자 정보를 확인합니다.
    if (req.session.user) {
        // 현재 사용자의 ID를 추출합니다.
        const userId = req.session.user.userid;

        // "friend" 컬렉션에서 현재 사용자의 친구 목록을 조회합니다.
        mydb.collection("friend")
            .findOne({ userid: userId })
            .then((result) => {
                // 조회 결과가 있고, 친구 목록이 비어있지 않은 경우
                if (result && result.friends) {
                    // "account" 컬렉션에서 친구 목록에 해당하는 사용자 정보를 조회합니다.
                    mydb.collection("account")
                        .find({ userid: { $in: result.friends } })
                        .toArray()
                        .then((friendsData) => {
                            // 조회된 친구 데이터를 사용하여 친구 목록 페이지를 렌더링합니다.
                            res.render("friend.ejs", { friendsData: friendsData });
                        })
                        .catch((err) => {
                            // 사용자 정보 조회 중 오류가 발생하면 서버 콘솔에 오류를 출력하고 클라이언트에게 500 상태 코드를 반환합니다.
                            console.error(`친구 목록 조회 중 오류 발생: ${err}`);
                            res.status(500).send("Internal Server Error");
                        });
                } else {
                    // 친구 목록이 비어있는 경우 빈 배열을 사용하여 친구 목록 페이지를 렌더링합니다.
                    console.log(`${userId}의 친구 목록이 없습니다.`);
                    res.render("friend.ejs", { friendsData: [] });
                }
            })
            .catch((err) => {
                // 친구 목록 조회 중 오류가 발생하면 서버 콘솔에 오류를 출력하고 클라이언트에게 500 상태 코드를 반환합니다.
                console.error(`친구 목록 조회 중 오류 발생: ${err}`);
                res.status(500).send("Internal Server Error");
            });
    } else {
        // 사용자가 로그인하지 않은 경우 로그인 페이지로 리다이렉트합니다.
        res.render("login.ejs");
    }
});

// 친구 추가 처리 라우트
app.post("/add-friend", function (req, res) {
    // 클라이언트에서 전달된 친구 ID와 현재 사용자 ID를 추출합니다.
    const friendId = req.body.friendId;
    const userId = req.session.user.userid;

    // "account" 컬렉션에서 입력된 친구 ID에 해당하는 사용자 정보를 조회합니다.
    mydb.collection("account")
        .findOne({ userid: friendId })
        .then((friend) => {
            // 조회된 사용자 정보가 있는 경우
            if (friend) {
                // "friend" 컬렉션에서 현재 사용자의 ID에 해당하는 친구 목록에 친구 ID를 추가합니다.
                mydb.collection("friend")
                    .updateOne(
                        { userid: userId },
                        { $addToSet: { friends: friendId } }, // $addToSet을 사용하여 중복된 값이 추가되지 않도록 합니다.
                        { upsert: true } // upsert 옵션을 사용하여 해당 문서가 없는 경우 새로 생성합니다.
                    )
                    .then((result) => {
                        // 친구 추가가 성공하면 서버 콘솔에 메시지를 출력하고 친구 목록 페이지로 리다이렉트합니다.
                        console.log(`${userId}님이 ${friendId}를 친구로 추가했습니다.`);
                        res.redirect("/friend");
                    })
                    .catch((err) => {
                        // 친구 추가 중 오류가 발생하면 서버 콘솔에 오류를 출력하고 클라이언트에게 500 상태 코드를 반환합니다.
                        console.error(`친구 추가 중 오류 발생: ${err}`);
                        res.status(500).send("Internal Server Error");
                    });
            } else {
                // 조회된 사용자 정보가 없는 경우 서버 콘솔에 메시지를 출력하고 친구 목록 페이지로 리다이렉트합니다.
                console.log(`${friendId}는 회원으로 등록되어 있지 않습니다.`);
                res.redirect("/friend");
            }
        })
        .catch((err) => {
            // 사용자 정보 조회 중 오류가 발생하면 서버 콘솔에 오류를 출력하고 클라이언트에게 500 상태 코드를 반환합니다.
            console.error(`회원 확인 중 오류 발생: ${err}`);
            res.status(500).send("Internal Server Error");
        });
});

// 사용자와 친구 ID를 가져오는 함수
async function getUserAndFriendIds(userId) {
    // "friend" 컬렉션에서 현재 사용자의 ID에 해당하는 친구 정보를 조회합니다.
    const friendData = await mydb.collection("friend").findOne({ userid: userId });

    // 친구 정보가 있고, 친구 목록이 비어있지 않은 경우 친구 목록을 반환합니다.
    if (friendData && friendData.friends) {
        return [userId, ...friendData.friends];
    } else {
        // 친구 정보가 없거나 친구 목록이 비어있는 경우 현재 사용자의 ID만 포함된 배열을 반환합니다.
        return [userId];
    }
}

