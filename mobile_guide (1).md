# Mobile Integration Guide

What changed in the API, and exactly how to use it. Five changes.

**Status:** changes are in the working tree, not committed yet. Nothing is live until
this is deployed — pin your integration to a date, not a branch.

Base URL in all examples: `https://example.com`

Each change below has a **Prompt for your agent** block. Paste it into your own AI
assistant and it will do the work for you. They're written to be self-contained.

---

## 1. What changed — read this first

| # | Change | Impact on you |
|---|--------|----------------|
| 1 | `POST /api/team/properties/status` → **`POST /api/team/leads/status`** | **Breaking.** Old URL now 404s. Update every call site. |
| 2 | Lead detail always returns `company` + `login` | Non-breaking. Keys are now `null` instead of absent. |
| 3 | `POST /api/team/leads/info` now checks lead ownership | **Breaking.** Returns `403` where it used to return `201`. |
| 4 | **New endpoint:** `POST /api/team/leads/:id/comments` | **New.** Lead comments were read-only; you can now post them. |
| 5 | **New endpoint:** `POST /api/team/meetings/create` | **New.** Meetings were read-only; you can now log one. |

Two further fixes were already uncommitted before this batch and are also live:
`requests_single` route parameters were passing the wrong positions, and the login
method's user-type argument was corrected.

The team login now authenticates against the **same employee login the web app uses**
(it used to call the user-login model), and the response body carries the employee's
permission flags. Details in section 2. Nothing about the cookie flow changed.

**Action items:**

1. Search your codebase for `properties/status` and change it to `leads/status`. This is
   the only hard break in existing code.
2. If you upload files against leads that aren't assigned to you, that flow now fails
   with `403`. The web UI only ever offers your own leads, so this only bites if you
   built something that crossed that line.
3. Wire up the new lead comment endpoint wherever you render a lead's comment thread.
4. Wire up the new meeting endpoint wherever you log a meeting against a lead.
5. Everything else is additive.

---

## 2. Auth — cookie based, one change in the response

The API does **not** use Bearer tokens. It uses a CodeIgniter session cookie.

```
POST /api/team/auth/login      →  Set-Cookie: ci_session=<value>
GET  /api/team/meetings        →  Cookie: ci_session=<value>
```

- Store `ci_session` on login, send it on **every** subsequent request.
- It expires after **2 hours**. On any `401`, clear it, re-login, retry once.
- CSRF is disabled — no token needed.

**Cookie interceptor (Kotlin/OkHttp):**

```kotlin
class SessionInterceptor(private val store: SessionStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        store.cookie()?.let {
            return chain.proceed(
                original.newBuilder().header("Cookie", "ci_session=$it").build()
            )
        }
        return chain.proceed(original)
    }
}
```

**Swift/URLSession** — use an `HTTPCookieStorage` shared instance and let it handle
this. Point `HTTPCookieStorage.shared.cookieAcceptPolicy = .always`, then just do normal
requests; URLSession persists and replays the cookie for you. Handle `401` by re-logging in.

**The login response now carries your permissions.** The team login authenticates
against the same employee login the web app uses, and the 200 body returns the
employee's permission flags alongside the profile:

```json
{ "status": true, "message": "Login successful",
  "data": { "employee": { "emp_id": 5, "name": "Sumeet Khan", "...": "..." },
            "permissions": { "company": "1", "request": "1", "meeting": "1", "...": "..." } } }
```

Use `data.permissions` to hide menu items the employee has no access to — same flags the
web UI gates on. `data.employee.emp_special` is now the employee id (it used to be a
`0`/`1` flag), so don't treat it as a boolean.

---

## 3. Pipeline toggle (changed)

Update a lead's CRM stage. **This is not a property** despite the old URL.

### Before → after

```
POST /api/team/properties/status     ← dead, 404s
POST /api/team/leads/status          ← use this
```

### Request

`id` is a **lead id** (`email_history.e_id`). It is not a property id and it is not a
task id. If your app was sending a property id here, that was always wrong.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | int | Yes | Lead id. Must be numeric. |
| `field` | string | Yes | `pipeline` or `deal_done` — nothing else is accepted |
| `status` | string | Yes | New value for that field |

**Both JSON and form-encoded are now accepted.** JSON was previously rejected with a
misleading `Invalid field` error even on well-formed requests.

```bash
curl -b cookies.txt -X POST "https://example.com/api/team/leads/status" \
  -H "Content-Type: application/json" \
  -d '{"id":208,"field":"deal_done","status":1}'
```

**Success (200):**
```json
{ "status": true, "message": "Status updated successfully",
  "data": { "status": "success" } }
```

### Ownership — the important behavioural change

You can only update a lead assigned to you.

| Code | Message | Meaning |
|------|---------|---------|
| `400` | `Invalid field` | `field` was not `pipeline` or `deal_done` |
| `400` | `Invalid id` | `id` missing or not numeric |
| `400` | `status is required` | `status` was empty |
| `401` | `Unauthorized` | Session missing or expired |
| `403` | `You can only update leads assigned to you.` | Lead belongs to another employee |
| `404` | `Lead not found` | No lead with that id |

A lead with **no assignee** (`employee_id` null or `0`) can be updated by any employee —
so unassigned leads stay claimable. Don't gate the toggle on a cached assignment flag;
just surface the `403`.

**Retrofit:**

```kotlin
@FormUrlEncoded
@POST("api/team/leads/status")
suspend fun updateLeadStatus(
    @Field("id") id: Int,
    @Field("field") field: String,   // "pipeline" | "deal_done"
    @Field("status") status: String
): ApiResponse<StatusResult>
```

Use `@FormUrlEncoded` and it works for both content types — simplest path. To send JSON,
add a `@Body` variant instead.

### Prompt for your agent

> In our mobile app, find every reference to the API path `api/team/properties/status` and
> replace it with `api/team/leads/status`. The endpoint body is unchanged: it takes
> `id`, `field`, and `status`. Do not change the request body, the Retrofit/URLSession
> method signature, or any other endpoint path — only this one path string.
>
> Then update the error handling on this call: it can now return `403` with the message
> "You can only update leads assigned to you." (lead belongs to another employee),
> `404` with "Lead not found", and `400` for a bad `field`, a non-numeric `id`, or an
> empty `status`. Surface those as user-visible messages. Do not silently swallow them.
>
> Finally, confirm no `properties/status` reference remains by searching the repo again
> and showing me the result.

---

## 4. Lead detail (changed)

```
GET /api/team/requests/:id
```

### What changed

`company` and `login` are **always present** in `data`. Previously they were missing
entirely unless you used a longer URL, which showed up as an absent key rather than an
error.

```json
{
  "status": true,
  "message": "Single request details",
  "data": {
    "categories": [],
    "requests": {},
    "comments": [],
    "leads_detail": {},
    "lead_id": 1421,
    "company": null,
    "login": null
  }
}
```

You can now bind to those fields without null-guarding on a missing key. **They can
still be `null`** — keep them optional in your model.

### Getting them populated — two-step flow

The short URL returns both as `null`. To fill them you need the company id and employee
id **up front**, which the short URL does not give you. So:

**Step 1** — read the ids off your list call. `GET /api/team/leads/filter` returns
`e_co_id` (company) and `employee_id` (employee) on every lead row. `GET /api/team/requests`
also works.

**Step 2** — call the long form with both:

```
GET /api/team/requests/1421/company/1115
GET /api/team/requests/1421/company/1115/emp/5
```

| Key | Populated when |
|-----|----------------|
| `categories` | always |
| `requests` | always |
| `comments` | always — the lead's comment thread |
| `leads_detail` | always |
| `lead_id` | always |
| `company` | `company_id` in the path, else `null` |
| `login` | `emp_id` in the path, else `null` |

Practical advice: call the short URL for the detail screen, render it, then fire the
long URL to backfill the company card and employee vCard. Don't block first paint on it.

**Not changed, still open:** the `emp_id` in that URL is client-supplied and not
validated — `get_vcard()` will return any employee's vCard. Low severity, but don't
treat it as an access control.

### Prompt for your agent

> Our lead detail screen calls `GET /api/team/requests/{id}`. The response's `data`
> object now always contains `company` and `login` keys — previously they were absent
> unless a longer URL was used. Update our response model so these two fields are
> optional/nullable rather than required, and update the UI to handle them being `null`.
>
> Do not add a separate network call for them on first paint. The short URL returns both
> as `null` by design. If the current screen shows a company card or an employee vCard,
> keep that section hidden when the field is `null` rather than showing an empty shell.
>
> Leave every other field in the response model untouched.

---

## 5. Upload lead info (changed)

This backs the web app's "Upload Lead Info" modal — the one with the "Select a Lead:"
dropdown and an image picker.

```
POST /api/team/leads/info
Content-Type: multipart/form-data
```

### The dropdown is mislabelled

The web dropdown says **"Select a Lead:"** but its field name is `title` — it is a
**document type** picker, not a lead picker. The actual lead comes from the screen the
employee is already on.

**There is no endpoint that populates this dropdown. Hardcode the 12 options.**

### Request

| Part | Type | Required | Notes |
|------|------|----------|-------|
| `lead_id` | int | Yes | Lead id — from the screen context, **not** from this dropdown |
| `title` | string | Yes | One of the 12 values below, verbatim |
| `img_file` | file | Yes | Field name is exactly `img_file` |

### The 12 options — send the value, not the label

| Send as `title` | Show the user |
|-----------------|---------------|
| `Call with Investor` | Upload Screen shot of Employee Call with investor |
| `Conference Call` | Upload Screen shot of Employee Conference Call with investor |
| `Zoom Call` | Upload Screen shot of Employee Zoom Call with investor |
| `Physical Meeting With Invester` | Upload Screen shot of Physical meeting of brand with investor |
| `Franchise Model Share via Whatsapp` | Upload Screen Shot of Brand Franchise Model to share via whatsapp |
| `Location Picture` | Upload location picture if investor has |
| `Invoice` | Upload Invoice |
| `Receipt` | Upload Receipt |
| `Success Story` | Upload Success story |
| `Commission` | Employe commission |
| `V Card` | Employe V.card |
| `Email` | Upload Email |

**Do not fix the typos.** `Invester`, `Employe`, and lowercase `whatsapp` are in the
values on purpose. The value is stored as the caption, so "correcting" them writes a
different string than the web writes and splits your data into two buckets the moment
anyone filters by it.

### File rules

| Rule | Value |
|------|-------|
| Allowed types | `jpg`, `jpeg`, `png`, `gif` — **no PDF** |
| Max size | 5048 KB = **4.93 MB** |
| Filename | randomised server-side — never construct one |

Validate type and size **before** uploading. A rejected file costs a full round trip and
shows the user a server error instead of an instant, clear message.

**`Invoice` and `Receipt` accept images only.** A real invoice is normally a PDF and
will be rejected. Either tell the employee to screenshot it, or ask the backend to add
`pdf` to the allowed types. Currently unresolved — flag it if your users hit it.

### Success and image URL

```json
{ "status": true, "message": "Lead uploaded successfully",
  "data": { "lead_id": 1421, "img_path": "public/admin/leads/a1b2c3d4e5.jpg" } }
```

`img_path` is **relative**. Build the display URL as:

```
{BASE_URL}/{img_path}   →   https://example.com/public/admin/leands/a1b2c3d4e5.jpg
```

That path resolves directly — existing files are served without a rewrite. Persist the
full URL, not the relative path, so you don't have to re-derive it later.

### Ownership

You can only upload against a lead assigned to you. Unassigned leads are open to
everyone. The check runs **before** the file is written, so a `403` leaves nothing behind
— you will not accumulate orphaned uploads from rejected requests.

| Code | Message | Meaning |
|------|---------|---------|
| `400` | `Lead and title are required` | `lead_id` or `title` missing |
| `400` | `No file was uploaded` | File part absent |
| `401` | `Unauthorized` | Session missing or expired |
| `403` | `You can only upload files for leads assigned to you.` | Lead belongs to another employee |
| `404` | `Lead not found` | No lead with that id |
| `500` | `Could not save lead in database` | Insert failed — **the file is already on disk** |

### CI3 error messages arrive verbatim

Surface these as-is; they're already user-readable:

| Message | Cause |
|---------|-------|
| `The filetype you are attempting to upload is not allowed.` | Wrong type |
| `The file you are attempting to upload is larger than the permitted size.` | Over 4.93 MB |
| `The uploaded file exceeds the maximum allowed size in your PHP configuration file.` | PHP's own cap is lower than the endpoint's — the server's `upload_max_filesize` is the real limit here |

If you get the third message on a 4 MB file, it is not your bug and not ours. The server
config is the constraint.

### Retrofit

```kotlin
@Multipart
@POST("api/team/leads/info")
suspend fun uploadLeadInfo(
    @Part("lead_id") leadId: RequestBody,
    @Part("title") title: RequestBody,
    @Part imgFile: MultipartBody.Part
): ApiResponse<LeadUploadResult>
```

Build the parts with `"text".toRequestBody()` and the image with
`file.asRequestBody("image/jpeg".toMediaType())`. Note `@Part("lead_id")` without a
filename sends a plain text part — that's what the server reads.

### Prompt for your agent

> Build the "Upload Lead Info" screen. It attaches one image to a lead the employee is
> already viewing.
>
> Call `POST /api/team/leads/info` as `multipart/form-data` with exactly three parts:
> `lead_id` (Int), `title` (String), and `img_file` (the file, field name must be
> `img_file`).
>
> The `title` value comes from a picker. **There is no API that returns these options —
> hardcode this list as (value, label) pairs and send the value:**
> `Call with Investor`, `Conference Call`, `Zoom Call`,
> `Physical Meeting With Invester`, `Franchise Model Share via Whatsapp`,
> `Location Picture`, `Invoice`, `Receipt`, `Success Story`, `Commission`, `V Card`,
> `Email`. Use the descriptive labels from mobile_guide.md for display. Do not spellcheck
> or correct any of these strings — they are stored verbatim and must match exactly.
>
> Validate client-side before uploading: reject anything that isn't jpg/jpeg/png/gif, and
> reject anything over 4.93 MB, with an inline message on the file field rather than
> waiting for a server error.
>
> The response returns `img_path` as a **relative** path like
> `public/admin/leads/a1b2c3.jpg`. Build the display URL as `{BASE_URL}/{img_path}` and
> store that full URL.
>
> Handle these errors explicitly: `403` ("You can only upload files for leads assigned to
> you.") and `404` ("Lead not found"). Do not retry a 403 — it will always fail.

---

## 6. Lead comments (new endpoint)

```
POST /api/team/leads/:id/comments
```

**This is new.** Previously you could read a lead's comment thread but not post to it.

### Request

The lead id is the path segment. `comment` is the only body field.

| Where | Field | Type | Required | Notes |
|-------|-------|------|----------|-------|
| Path | `:id` | int | Yes | Lead id — the same id you use for `GET /api/team/requests/:id` |
| Body | `comment` | string | Yes | Trimmed server-side; whitespace-only is rejected with `400` |

Both JSON and form-encoded are accepted — unlike task comments (see section 8).

```bash
curl -b cookies.txt -X POST "https://example.com/api/team/leads/1421/comments" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Called the investor, sending the model tomorrow"}'
```

**Success (201):**
```json
{ "status": true, "message": "Lead comment added successfully",
  "data": { "lead_id": 1421 } }
```

**The response does not contain the new comment's id.** After a successful post, refresh
the thread by re-calling `GET /api/team/requests/:id` and reading `data.comments`. Don't
try to construct the new row client-side.

### Reading the thread back

There is **no standalone `GET .../comments`** endpoint. The thread always comes back
inside the lead detail call as `data.comments`.

### Attribution is automatic

You do not send your name. The server stamps the comment with the logged-in employee's
name from the session. Unassigned leads can be commented on by any employee.

### Ownership

| Code | Message | Meaning |
|------|---------|---------|
| `400` | `Comment is required` | Missing, empty, or whitespace only |
| `401` | `Unauthorized` | Session missing or expired |
| `403` | `You can only comment on leads assigned to you.` | Lead belongs to another employee |
| `404` | `Lead not found` | No lead with that id |
| `500` | `Failed to add lead comment` | Insert rejected |

### Retrofit

```kotlin
@FormUrlEncoded
@POST("api/team/leads/{id}/comments")
suspend fun addLeadComment(
    @Path("id") leadId: Int,
    @Field("comment") comment: String
): ApiResponse<LeadCommentResult>
```

`@FormUrlEncoded` works here. Do **not** reuse the task-comment method from section 8 —
it's a different endpoint with different behaviour.

### Prompt for your agent

> On our lead detail screen we already display the comment thread from
> `GET /api/team/requests/{id}` (field `data.comments`). Add a comment composer under it.
>
> On submit, call `POST /api/team/leads/{id}/comments` with the lead id as the path
> segment and the comment text as a `comment` form field. This endpoint accepts both JSON
> and form-encoded bodies.
>
> The 201 response contains only `lead_id` — it does not return the new comment or its id.
> So after a successful post, re-fetch `GET /api/team/requests/{id}` and re-render the
> thread from `data.comments`. Do not optimistically append the comment to local state.
>
> Disable the send button while the request is in flight, and trim the input before
> sending — the server rejects whitespace-only comments with a 400 "Comment is required".
>
> Handle `403` ("You can only comment on leads assigned to you.") by showing a message
> and disabling the composer, and `404` ("Lead not found") by navigating back. Do not
> retry either one.

---

## 7. Create a meeting (new endpoint)

```
POST /api/team/meetings/create
```

**This is new.** `GET /api/team/meetings` and `GET /api/team/brand-meetings` were
read-only — there was no way to log a meeting from mobile. Now there is.

This backs the web app's meeting form, so the field names match the web form exactly.

### Request

JSON and form-encoded are both accepted.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `date` | string | Yes | Meeting date |
| `time` | string | Yes | Meeting time |
| `venue` | string | Yes | Where it happened |
| `desc` | string | Yes | What was discussed |
| `com_id` | int | Yes | Company id |
| `company` | string | Yes | Company name |
| `person` | string | Yes | Company contact person |
| `meeting_type` | string | No | `1`, `2` or `3`. Omit for no meeting type |
| `franchisephoneno` | string | No | Franchise phone number |
| `franchise` | string | No | Franchisee name |
| `email` | string | No | Contact email |
| `company_contact_no` | string | No | Company phone number |
| `request_id` | int | No | Lead id to attach the meeting to. Aliases: `lead_id`, `request` |

**Do not send the employee id or name.** `emp_id` and `emp_name` come from the session
— the server stamps them.

### `meeting_type` — numbers only

| Send | Means |
|------|-------|
| `1` | Physical meeting |
| `2` | Conference call |
| `3` | Zoom call |
| *(omit)* | No meeting type |

**Send the number, not the label.** `"physical"`, `"all"`, or any other string returns
`400 Invalid meeting_type`. `"All"` is a filter-only value used by the leads filter —
it is not a stored type.

### `request_id` is not checked

Any numeric id is accepted and stored as sent. The server does not verify that the lead
exists, and does not verify that it belongs to you. Send the lead you are working on.

### Success (201)

```json
{ "status": true, "message": "Meeting added successfully",
  "data": { "request_id": 1421, "meeting_type": "1", "emp_id": 5,
            "emp_name": "Sumeet Khan",
            "meeting_date": "2026-10-22", "meeting_time": "14:30" } }
```

`data.meeting_id` is present only when the server returns a row id — treat it as
optional.

### No SMS

The web controller fires four SMS helpers after creating a meeting. Those are legacy
and unused in the models, and the API does not call them. If you were expecting a text
message to the company after logging a meeting — it does not happen.

### Errors

| Code | Message | Meaning |
|------|---------|---------|
| `400` | `date required, time required, ...` | Missing fields — the message lists every missing one, comma separated |
| `400` | `Invalid meeting_type` | Not `1`, `2` or `3` |
| `400` | `Invalid request_id` | `request_id` was present but not numeric |
| `401` | `Unauthorized` | Session missing or expired |
| `500` | `Error in insertion` | The insert was rejected |

### Retrofit

```kotlin
@FormUrlEncoded
@POST("api/team/meetings/create")
suspend fun createMeeting(
    @Field("date") date: String,
    @Field("time") time: String,
    @Field("venue") venue: String,
    @Field("desc") desc: String,
    @Field("com_id") comId: Int,
    @Field("company") company: String,
    @Field("person") person: String,
    @Field("meeting_type") meetingType: String?,   // "1" | "2" | "3"
    @Field("request_id") requestId: Int?
): ApiResponse<MeetingCreatedResult>
```

### Prompt for your agent

> Add a "log a meeting" form. It posts to `POST /api/team/meetings/create`, form-encoded
> (`@FormUrlEncoded`), with the fields: `date`, `time`, `venue`, `desc`, `com_id`,
> `company`, `person`, `meeting_type`, and `request_id`.
>
> `emp_id` and `emp_name` are NOT request fields — the server takes them from the
> session. Do not send them.
>
> `meeting_type` is a numeric picker with exactly three options: `1` = Physical,
> `2` = Conference call, `3` = Zoom. Send the number as a string. Do not send labels and
> do not offer an "All" option — the server rejects anything other than 1/2/3 with a 400
> `Invalid meeting_type`.
>
> `request_id` is the lead id the meeting belongs to. Send it when the form was opened
> from a lead; omit it (null) when the meeting has no lead. The server does not validate
> it, so only send a lead id you actually mean.
>
> On a 400, show the server's message verbatim — it lists the missing fields by name.
> On a 401, re-login and retry once. Do not retry a 400.
>
> The response is a 201 with `data.request_id`, `data.meeting_type` and `data.emp_name`.
> `data.meeting_id` may be absent. After a successful create, refresh the meeting list
> with `GET /api/team/meetings` rather than appending the row locally.

---

## 8. Known pitfalls, not fixed in this batch

These are live now and will cost you a debugging session if you're not aware.

**Task comments need form-encoded, not JSON.**
`POST /api/team/tasks/:id/comments` only injects `task_id` into the POST body. The
`comment` field itself is read from `$_POST`, so a JSON body arrives with an empty
comment and the server returns `500`. Use `@FormUrlEncoded`. This does **not** affect
lead comments in section 6, which accept JSON fine.

```kotlin
@FormUrlEncoded
@POST("api/team/tasks/{id}/comments")
suspend fun addTaskComment(
    @Path("id") taskId: Int,
    @Field("comment") comment: String
): ApiResponse<CommentResult>
```

**There is no standalone comments endpoint for tasks.** The thread only comes back
inside `GET /api/team/tasks/:id`, as `data.comments`. There's no `GET .../comments`.
Same for leads — see section 6.

**`POST /api/team/tasks/:id/status` takes an assign_id, not a task id.** The path
segment is the *assignment* id — it comes from `data.assign.assign_id` in the task
detail response, not from `data.task.id`. Send `status` in the body; `taskid` is
optional.

**Meetings can be created now.** `POST /api/team/meetings/create` exists — see
section 7. **Update is still not exposed**: there is no `PUT`/`PATCH` meeting endpoint,
so a meeting row cannot be edited after it is created. `GET /api/team/meetings` and
`GET /api/team/brand-meetings` are still read-only.

---

## 9. Verification checklist before you ship

1. `grep -r "properties/status"` returns nothing.
2. `POST /api/team/leads/status` with a JSON body returns `200`, not `400`.
3. Updating a lead you don't own returns `403`, not `201`.
4. `GET /api/team/requests/:id` response has `company` and `login` keys present.
5. Uploading a PDF returns a clear error before the user waits on the network.
6. Uploading to a lead you don't own returns `403` and leaves no file behind.
7. Posting a lead comment returns `201` and the thread shows it after a refresh.
8. Posting a lead comment to a lead you don't own returns `403`, and the composer
   disables rather than retrying.
9. Your session interceptor survives a `401` and re-logins.
10. Creating a meeting returns `201`, and the meeting shows up in `GET /api/team/meetings`.
11. Sending `meeting_type: "physical"` returns `400 Invalid meeting_type` — you are
    sending the number, not the label.