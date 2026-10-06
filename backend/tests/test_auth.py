API = "/api/v1"


def test_register_login_me(client, auth):
    me = client.get(f"{API}/me", headers=auth)
    assert me.status_code == 200 and me.json()["display_name"] == "Milane"
    assert me.json()["settings"]["onboarding_completed"] is False

    r = client.post(f"{API}/auth/login", json={"email": "MILANE@example.com", "password": "motdepasse123"})
    assert r.status_code == 200 and "access_token" in r.json()
    assert "httponly" in r.headers["set-cookie"].lower()


def test_rejects_bad_credentials_and_duplicates(client, auth):
    assert client.post(f"{API}/auth/login", json={"email": "milane@example.com", "password": "nope"}).status_code == 401
    dup = client.post(f"{API}/auth/register", json={"email": "milane@example.com", "password": "motdepasse123", "display_name": "X"})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "email_taken"
    short = client.post(f"{API}/auth/register", json={"email": "a@example.com", "password": "123", "display_name": "X"})
    assert short.status_code == 422 and short.json()["error"]["fields"][0]["field"] == "password"


def test_protected_routes_need_a_token(client):
    assert client.get(f"{API}/me").status_code == 401
    assert client.get(f"{API}/goals", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_refresh_rotation_and_reuse_detection(client, auth):
    old = client.cookies.get("thabat_rt")
    r1 = client.post(f"{API}/auth/refresh")
    assert r1.status_code == 200
    new = client.cookies.get("thabat_rt")
    assert new and new != old
    # replaying the old token is treated as theft: the whole family is revoked
    client.cookies.clear()
    assert client.post(f"{API}/auth/refresh", cookies={"thabat_rt": old}).status_code == 401
    assert client.post(f"{API}/auth/refresh", cookies={"thabat_rt": new}).status_code == 401


def test_logout_revokes_refresh_token(client, auth):
    token = client.cookies.get("thabat_rt")
    assert client.post(f"{API}/auth/logout").status_code == 204
    assert client.post(f"{API}/auth/refresh", cookies={"thabat_rt": token}).status_code == 401
