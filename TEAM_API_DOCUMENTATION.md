# Team API Documentation

Internal employee/team dashboard API, served by `application/controllers/TeamApi.php`.

Base URL: `https://example.com/api/team`

All endpoints are prefixed with `/api/team/`. All responses are JSON.

**This file covers the Team API only.** The public/consumer API (`Api.php`) and the
brand/company dashboard API (`UserpanelApi.php`) are documented in
[`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).

---

## Contents

1. [Authentication](#authentication)
2. [Endpoint Summary](#endpoint-summary)
3. [Dashboard](#dashboard)
4. [Tasks](#tasks)
5. [Reports](#reports)
6. [Brands](#brands)
7. [Properties](#properties)
8. [Meetings](#meetings)
9. [Companies](#companies)
10. [Users](#users)
11. [Jobs](#jobs)
12. [Events](#events)
13. [Downloads](#downloads)
14. [Franchise](#franchise)
15. [Requests](#requests)
16. [Investor Requests](#investor-requests)
17. [Advertisements](#advertisements)
18. [Subscribers](#subscribers)
19. [Error Codes](#error-codes)
20. [Worked Example](#worked-example)
21. [Notes and Constraints](#notes-and-constraints)

---

## Standard Response Format

Every endpoint returns:

```json
{
  "status": true,
  "message": "Success",
  "data": { }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | boolean | `true` = success, `false` = error |
| `message` | string | Human-readable message |
| `data` | object/array | The payload (`null` on error) |

Implemented in `MY_Controller::response()` and `MY_Controller::response_error()`.
Both `exit` after echoing, so no endpoint emits more than one JSON body.

### Content-Type

Responses always come back as `application/json; charset=utf-8` (set in
`MY_Controller::__construct()`). `Access-Control-Allow-Origin: *` is also set there,
plus `GET, POST, PUT, DELETE, OPTIONS` and the headers `Content-Type, Authorization,
X-Requested-With`. `OPTIONS` preflight returns `204` and exits.

---

## Authentication

**Every endpoint except `login` requires an employee session.**

### Session model

The API uses the **same CI3 session as the web application**. There is no token, no
JWT, no `Authorization` header.

`login` stores two session keys, and both are required because the codebase reads
them from different places:

| Session key | Read by | Purpose |
|-------------|---------|---------|
| `emp_id` | `TeamApi` — `dashboard`, `brands_view`, `meetings`, `brand_meetings`, `requests` | Scopes queries to the logged-in employee |
| `user_id` | `MY_Controller::check_session()` — the guard on every protected method | Gate for authentication |

> **If you change the login method, set both keys.** Every endpoint calls
> `TeamApi::actor()`, which calls `check_session()` (checks `user_id`) and then
> returns `emp_id`. Dropping either key makes the whole API return `401` or
> silently scope queries to `null`.

### Cookie handling

- Login sets the `ci_session` cookie automatically (CI3 session library).
- The client MUST store it and send it on every subsequent request.
- The cookie expires after 2 hours (`Max-Age=7200`).
- CSRF is disabled on the API server — no `csrf_token` is needed.

```bash
# Step 1 — login, saves the cookie to cookies.txt
curl -i -c cookies.txt -X POST "https://example.com/api/team/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@franchisepk.com","password":"secret123"}'

# Step 2 — authenticated call, reads the cookie from the file
curl -b cookies.txt "https://example.com/api/team/dashboard"
```

**Mobile app:** store the `ci_session` cookie from the login response and send it as
`Cookie: ci_session=<value>` on every subsequent request.

---

### POST `/api/team/auth/login`

Authenticate an employee and start a CI3 session.

**Auth required:** No

**curl (JSON):**
```bash
curl -i -c cookies.txt -X POST "https://example.com/api/team/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@franchisepk.com","password":"secret123"}'
```

**curl (form-encoded):**
```bash
curl -i -c cookies.txt -X POST "https://example.com/api/team/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=employee@franchisepk.com&password=secret123"
```

**Request body:**

| Field | Required | Aliases accepted | Notes |
|-------|----------|------------------|-------|
| `email` | Yes | `u_email` | Employee login email |
| `password` | Yes | `pass` | Plain-text password, compared server-side |

**Success (200):**
- `Set-Cookie: ci_session=<value>; HttpOnly` (auto-emitted by CI3)

```json
{
  "status": true,
  "message": "Login successful",
  "data": {
    "employee": {
      "emp_id": 5,
      "firstname": "Sumeet",
      "lastname": "Khan",
      "name": "Sumeet Khan",
      "email": "employee@franchisepk.com",
      "contact": "03171919170",
      "image": "Sumeet.jpeg",
      "position": "Sales Manager",
      "emp_special": "0"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `emp_id` | int | `u_id` of the employee — store this, it identifies the session owner |
| `emp_special` | string | `"1"` = admin-tier access, `"0"` = regular team member. The web UI branches on this flag; on the API it only affects which resources the employee is scoped to. |

**Errors:**
| Code | Meaning |
|------|---------|
| 400 | Email and password required |
| 401 | Invalid email or password |

---

### POST `/api/team/auth/logout`

Destroy the employee session. Unsets `emp_id`, `emp_special`, `user_id`, and the
`user_*` mirror keys.

**Auth required:** Yes

**curl:**
```bash
curl -i -b cookies.txt -X POST "https://example.com/api/team/auth/logout"
```

**Success (200):**
```json
{
  "status": true,
  "message": "Logged out successfully",
  "data": true
}
```

---

### GET `/api/team/auth/me`

Get the authenticated employee's profile.

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/auth/me"
```

**Success (200):**
```json
{
  "status": true,
  "message": "Employee profile",
  "data": {
    "emp_id": 5,
    "u_firstname": "Sumeet",
    "u_lastname": "Khan",
    "u_email": "employee@franchisepk.com",
    "a_position": "Sales Manager",
    "emp_special": "0"
  }
}
```

**Errors:**
| Code | Meaning |
|------|---------|
| 401 | No or expired session |
| 404 | Employee not found for the current `emp_id` |

---

## Endpoint Summary

| Method | Endpoint | Auth | Model call |
|--------|----------|------|-----------|
| POST | `/api/team/auth/login` | No | `User_model->login()` |
| POST | `/api/team/auth/logout` | Yes | — |
| GET | `/api/team/auth/me` | Yes | `Admin_model->get_emploeelist()`, filtered |
| GET | `/api/team/dashboard` | Yes | `Admin_model->all_nums()` |
| GET | `/api/team/tasks` | Yes | `Admin_model->get_tasks()` |
| GET | `/api/team/tasks/:id` | Yes | `Admin_model->get_single_tasks()` + 3 more |
| POST | `/api/team/tasks/:id/comments` | Yes | `Admin_model->add_taskcomment()` |
| POST | `/api/team/tasks/:assign_id/status` | Yes | `Admin_model->task_status()` |
| GET | `/api/team/reports` | Yes | `Admin_model->get_report()` |
| POST | `/api/team/reports/create` | Yes | `Admin_model->add_report()` |
| GET | `/api/team/brands` | Yes | `Admin_model->get_brands()` |
| POST | `/api/team/brands/create` | Yes | `Admin_model->add_brands()` |
| POST | `/api/team/brands/:id/update` | Yes | `Admin_model->update_brands()` |
| GET | `/api/team/shows/:city` | Yes | `Admin_model->get_show()` |
| GET | `/api/team/properties` | Yes | `home_m->get_categories()`, `property_m->get()` |
| POST | `/api/team/properties/create` | Yes | `Admin_model->add_properties()` |
| POST | `/api/team/properties/status` | Yes | `Admin_model->update_status()` |
| GET | `/api/team/meetings` | Yes | `Admin_model->get_meetings()` |
| GET | `/api/team/meetings/:id` | Yes | `Admin_model->get_single_meeting()` |
| GET | `/api/team/brand-meetings` | Yes | `Admin_model->get_brand_meetings()` |
| GET | `/api/team/companies` | Yes | `company_m->get_companies()` + 2 more |
| POST | `/api/team/companies/create` | Yes | `Admin_model->company_add()` + 2 more |
| POST | `/api/team/companies/:id/update` | Yes | `company_m->editpro()` |
| GET | `/api/team/companies/:id/edit` | Yes | `company_m->edit()` + 2 more |
| GET | `/api/team/users` | Yes | `home_m->get_users()` |
| POST | `/api/team/users/:id/update` | Yes | `Admin_model->user_update()` |
| GET | `/api/team/jobs` | Yes | `Admin_model->get_jobs()` |
| POST | `/api/team/jobs/create` | Yes | `Admin_model->add()` |
| POST | `/api/team/jobs/:id/update` | Yes | `jobs_m->editPro()` |
| POST | `/api/team/jobs/:id/delete` | Yes | `jobs_m->delete()` |
| GET | `/api/team/events` | Yes | `categories_m->get_events()` |
| POST | `/api/team/events/create` | Yes | `Admin_model->eventspro()` |
| GET | `/api/team/downloads` | Yes | `download_m->get()` |
| GET | `/api/team/franchise` | Yes | `franchise_m->get()` |
| GET | `/api/team/requests` | Yes | `home_m->get_emp_requests()` |
| GET | `/api/team/requests/:id` | Yes | `home_m->get_single_requests()` + 3 more |
| GET | `/api/team/requests/:id/company/:company_id` | Yes | same, includes poster |
| GET | `/api/team/requests/:id/company/:company_id/emp/:emp_id` | Yes | same, includes vCard |
| GET | `/api/team/investor-requests` | Yes | `home_m->get_investrequests()` |
| GET | `/api/team/advertisements` | Yes | `advertisements_m->get()` |
| GET | `/api/team/subscribers` | Yes | `home_m->get_subs()` |

**41 routes, 38 public methods.** Every public method has at least one route.

---

## Dashboard

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/dashboard` | Counter stats for the logged-in employee |

---

### GET `/api/team/dashboard`

Aggregate counts. Scoped to the session's `emp_id` — the same dashboard the web
`Team::Dashboard()` renders.

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/dashboard"
```

**Success (200):**
```json
{
  "status": true,
  "message": "Team dashboard",
  "data": {
    "stats": {
      "tasks": 14,
      "meetings": 6,
      "requests": 23,
      "companies": 12,
      "properties": 9
    }
  }
}
```

**Errors:** `401` = no or expired session.

---

## Tasks

| Method | Endpoint | Maps to web action |
|--------|----------|--------------------|
| GET | `/api/team/tasks` | task list |
| GET | `/api/team/tasks/:id` | task detail + comments + assignee + employee list |
| POST | `/api/team/tasks/:id/comments` | `add_taskcomment` |
| POST | `/api/team/tasks/:assign_id/status` | `task_status` |

---

### GET `/api/team/tasks`

List tasks, filtered by status.

**Auth required:** Yes

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | int | `0` | `0` = open/pending, `1` = completed (as the web controller uses it) |

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/tasks"
curl -b cookies.txt "https://example.com/api/team/tasks?status=1"
```

**Example:** `GET /api/team/tasks?status=1`

**Success (200):**
```json
{
  "status": true,
  "message": "Tasks list",
  "data": {
    "tasks": []
  }
}
```

---

### GET `/api/team/tasks/:id`

Full task detail. Returns the task, its assignment, its comment thread, and the
employee list needed for reassignment — enough to render the detail screen in one call.

**Auth required:** Yes

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | int | Task id |

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/tasks/12"
```

**Example:** `GET /api/team/tasks/12`

**Success (200) — keys in `data`:**
| Key | Type | Source |
|-----|------|--------|
| `task` | object | `Admin_model->get_single_tasks($id)` |
| `assign` | object | `Admin_model->get_assign_task($id)` |
| `comments` | array | `Admin_model->get_task_comments($id)` |
| `employee` | array | `Admin_model->get_emploeelist()` — dropdown for reassigning |

```json
{
  "status": true,
  "message": "Task details",
  "data": {
    "task": { "id": "12", "title": "Follow up Lahore leads", "status": "0" },
    "assign": { "assign_id": "34", "emp_id": "5", "emp_name": "Sumeet Khan" },
    "comments": [
      { "comment_id": "88", "comment": "Called, no answer", "created": "01-Oct-2026" }
    ],
    "employee": []
  }
}
```

**Errors:** `401` = no or expired session.

---

### POST `/api/team/tasks/:id/comments`

Add a comment to a task.

**Auth required:** Yes

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | int | Task id — can also be supplied as a `task_id` body field |

**curl (JSON):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/tasks/12/comments" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Called, no answer","task_id":12}'
```

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/tasks/12/comments" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "comment=Called%2C+no+answer"
```

**Request body:**
| Field | Required | Notes |
|-------|----------|-------|
| `comment` | Yes | Comment text, read by `Admin_model->add_taskcomment()` from `$_POST` |
| `task_id` | No | Overrides the `:id` path segment |

**Success (201):**
```json
{
  "status": true,
  "message": "Task comment added successfully",
  "data": { "task_id": 12 }
}
```

**Errors:**
| Code | Meaning |
|------|---------|
| 400 | Neither `:id` nor `task_id` supplied |
| 401 | No or expired session |
| 500 | Model rejected the insert |

---

### POST `/api/team/tasks/:assign_id/status`

Change a task assignment's status.

**Auth required:** Yes

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `assign_id` | int | Task-assignment id (**not** the task id) |

**Request body:**
| Field | Required | Notes |
|-------|----------|-------|
| `status` | Yes | New status value |
| `taskid` | No | Task id. Accepted for parity with the web form; not used for routing on the API. |

Send `status` in the body — the route passes only `assign_id`.

**curl:**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/tasks/34/status" \
  -H "Content-Type: application/json" \
  -d '{"status":1,"taskid":12}'
```

**Success (200):**
```json
{
  "status": true,
  "message": "Task status updated successfully",
  "data": true
}
```

**Errors:**
| Code | Meaning |
|------|---------|
| 400 | `status` missing or empty |
| 401 | No or expired session |
| 500 | Model rejected the update |

---

## Reports

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/reports` | List reports |
| POST | `/api/team/reports/create` | Add report |

---

### GET `/api/team/reports`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/reports"
```

**Success (200) — keys in `data`:**
| Key | Type | Description |
|-----|------|-------------|
| `reports` | array | Report rows |
| `type` | string | Always `"All"` — the filter applied |

```json
{
  "status": true,
  "message": "Reports list",
  "data": { "reports": [], "type": "All" }
}
```

---

### POST `/api/team/reports/create`

Add a report. Fields are read by `Admin_model->add_report()` from `$_POST`.

**Auth required:** Yes

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/reports/create" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=Monthly+summary&description=All+brands+contacted"
```

**Success (201):**
```json
{ "status": true, "message": "Report added successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Error in insertion.

---

## Brands

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/brands` | List brands |
| POST | `/api/team/brands/create` | Add brand |
| POST | `/api/team/brands/:id/update` | Update brand |
| GET | `/api/team/shows/:city` | Shows filtered by city |

---

### GET `/api/team/brands`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/brands"
```

**Success (200) — keys in `data`:** `brands` (array), `type` (always `"All"`).

```json
{
  "status": true,
  "message": "Brands list",
  "data": { "brands": [], "type": "All" }
}
```

---

### POST `/api/team/brands/create`

Fields read by `Admin_model->add_brands()` from `$_POST`.

**Auth required:** Yes

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/brands/create" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Acme&category_id=3&city_id=12"
```

**Success (201):**
```json
{ "status": true, "message": "Brand added successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Error in insertion.

---

### POST `/api/team/brands/:id/update`

**Auth required:** Yes

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | int | Brand id |

Fields read by `Admin_model->update_brands()` from `$_POST`.

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/brands/7/update" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Acme+Updated&category_id=3"
```

**Success (200):**
```json
{ "status": true, "message": "Brand updated successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Update failed.

---

### GET `/api/team/shows/:city`

Shows for a city, scoped to the logged-in employee.

**Auth required:** Yes

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `city` | string | City name or id — matched as `(:any)`, so slugs with spaces or punctuation still route |

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/shows/Lahore"
```

**Example:** `GET /api/team/shows/Lahore`

**Success (200):**
```json
{
  "status": true,
  "message": "Show list",
  "data": { "show": [] }
}
```

---

## Properties

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/properties` | List properties + categories |
| POST | `/api/team/properties/create` | Add property |
| POST | `/api/team/properties/status` | Toggle `pipeline` / `deal_done` |

---

### GET `/api/team/properties`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/properties"
```

**Success (200) — keys in `data`:** `categories` (array), `property` (array).

```json
{
  "status": true,
  "message": "Property list",
  "data": { "categories": [], "property": [] }
}
```

---

### POST `/api/team/properties/create`

Fields read by `Admin_model->add_properties()` from `$_POST`.

**Auth required:** Yes

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/properties/create" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "pName=Shiraz+Agora&pEmail=owner@example.com&pPhone=03488837452&Pcity=Peshawar"
```

**Success (201):**
```json
{ "status": true, "message": "Property added successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Error in insertion.

---

### POST `/api/team/properties/status`

Update one flag on a property. This is the pipeline board toggle.

**Auth required:** Yes

**Request body** — all read from `$_POST`, so send form-encoded:
| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Property id |
| `field` | Yes | `pipeline` or `deal_done` — **whitelisted server-side** |
| `status` | Yes | New value for that field |

**curl:**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/properties/status" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "id=208&field=deal_done&status=1"
```

**Success (200):**
```json
{
  "status": true,
  "message": "Status updated successfully",
  "data": { "status": "success" }
}
```

**Errors:**
| Code | Meaning |
|------|---------|
| 400 | `field` is not `pipeline` or `deal_done` |
| 401 | No or expired session |

---

## Meetings

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/meetings` | Meetings for the logged-in employee |
| GET | `/api/team/meetings/:id` | Single meeting |
| GET | `/api/team/brand-meetings` | Brand-side meetings |

---

### GET `/api/team/meetings`

**Auth required:** Yes

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | int | `1` | Meeting status filter, as used by the web controller |

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/meetings"
curl -b cookies.txt "https://example.com/api/team/meetings?status=0"
```

**Success (200) — keys in `data`:** `meetings` (array), `categories` (array, from `get_categories_view()`).

```json
{
  "status": true,
  "message": "Meetings list",
  "data": { "meetings": [], "categories": [] }
}
```

---

### GET `/api/team/meetings/:id`

**Auth required:** Yes

**Path params:** `id` (int) — meeting id

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/meetings/9"
```

**Example:** `GET /api/team/meetings/9`

**Success (200) — keys in `data`:** `request` (object), `categories` (array).

```json
{
  "status": true,
  "message": "Single meeting details",
  "data": { "request": {}, "categories": [] }
}
```

---

### GET `/api/team/brand-meetings`

Brand-side meetings for the logged-in employee. No status filter.

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/brand-meetings"
```

**Success (200) — keys in `data`:** `meetings` (array), `categories` (array).

```json
{
  "status": true,
  "message": "Brand meetings list",
  "data": { "meetings": [], "categories": [] }
}
```

---

## Companies

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/companies` | List + dropdown data |
| POST | `/api/team/companies/create` | Add company (supports images) |
| POST | `/api/team/companies/:id/update` | Update company |
| GET | `/api/team/companies/:id/edit` | Preload one company for editing |

---

### GET `/api/team/companies`

Everything the companies screen needs: the list plus both dropdown sources.

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/companies"
```

**Success (200) — keys in `data`:**
| Key | Type | Description |
|-----|------|-------------|
| `countries` | array | Country dropdown |
| `categories` | array | Category dropdown |
| `companies` | array | Company rows |
| `type` | string | Always `"All"` |

```json
{
  "status": true,
  "message": "Companies list",
  "data": { "countries": [], "categories": [], "companies": [], "type": "All" }
}
```

---

### POST `/api/team/companies/create`

Creates the company, its contact person, and its images — three model calls in
sequence. **Use `multipart/form-data` if you are uploading a logo**; the model reads
`$_FILES`.

**Auth required:** Yes

**curl (multipart with logo):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/companies/create" \
  -F "name=Acme Franchise" \
  -F "category_id=3" \
  -F "city_id=12" \
  -F "country_id=1" \
  -F "image[]=@/path/to/logo.jpg"
```

**curl (form-encoded, no upload):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/companies/create" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Acme+Franchise&category_id=3&city_id=12&country_id=1"
```

**Success (201):**
```json
{
  "status": true,
  "message": "Company added successfully",
  "data": { "company_id": 42 }
}
```

**Errors:**
| Code | Meaning |
|------|---------|
| 401 | No or expired session |
| 409 | `{name} has already registered` — duplicate company name |
| 500 | Sorry error occurred in insertion |

---

### POST `/api/team/companies/:id/update`

**Auth required:** Yes

**Path params:** `id` (int) — company id

Fields read by `company_m->editpro()` from `$_POST`.

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/companies/42/update" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Acme+Franchise+Updated"
```

**Success (200):**
```json
{ "status": true, "message": "Company updated successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Update failed.

---

### GET `/api/team/companies/:id/edit`

Preload a single company for the edit form.

**Auth required:** Yes

**Path params:** `id` (int) — company id

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/companies/42/edit"
```

**Success (200) — keys in `data`:** `company` (object — the first result row),
`countries` (array), `categories` (array).

```json
{
  "status": true,
  "message": "Company edit data",
  "data": { "company": {}, "countries": [], "categories": [] }
}
```

**Errors:** `401` = no or expired session, `404` = Company not found.

---

## Users

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/users` | List site users |
| POST | `/api/team/users/:id/update` | Update a user record |

---

### GET `/api/team/users`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/users"
```

**Success (200) — keys in `data`:** `users` (array), `categories` (array, from `get_categories_view()`).

```json
{
  "status": true,
  "message": "Users list",
  "data": { "users": [], "categories": [] }
}
```

---

### POST `/api/team/users/:id/update`

**Auth required:** Yes

**Path params:** `id` (int) — user id. Currently unused by the handler; `Admin_model->user_update()`
identifies the record from the body. Accepted for route consistency.

**Request body** — read from `$_POST`, so send form-encoded:

| Field | Required | Notes |
|-------|----------|-------|
| `fname` | Yes | → `u_firstname` |
| `lname` | Yes | → `u_lastname` |
| `User_email` | Yes | → `u_email` (capital U) |
| `contact` | Yes | → `u_contact` |
| `password` | No | → `u_password` |
| `company` | No | → `u_company` |
| `bio` | No | → `u_bio` |

Two fields are **forced by the server** and cannot be set from the request:
`status` = `'0'` and `payment_status` = `'0'`. `u_date` and `u_time` are stamped with
the current server time.

**curl:**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/users/8/update" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "fname=Ali&lname=Khan&User_email=ali@example.com&contact=03001234567&company=Foodies"
```

**Success (200):**
```json
{ "status": true, "message": "User updated successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = User update failed.

---

## Jobs

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/jobs` | List jobs |
| POST | `/api/team/jobs/create` | Add job |
| POST | `/api/team/jobs/:id/update` | Update job |
| POST | `/api/team/jobs/:id/delete` | Delete job |

---

### GET `/api/team/jobs`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/jobs"
```

**Success (200) — keys in `data`:** `categories` (array), `jobs` (array).

```json
{
  "status": true,
  "message": "Jobs list",
  "data": { "categories": [], "jobs": [] }
}
```

---

### POST `/api/team/jobs/create`

Fields read by `Admin_model->add()` from `$_POST`.

**Auth required:** Yes

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/jobs/create" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "j_brandName=Franchise+Pakistan&j_jobTitle=Web+Developer&j_salary=20000&j_qualification=Master"
```

**Success (201):**
```json
{ "status": true, "message": "Job added successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Error in insertion.

---

### POST `/api/team/jobs/:id/update`

**Auth required:** Yes

**Path params:** `id` (int) — job id

Fields read by `jobs_m->editPro($id)` from `$_POST`.

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/jobs/1/update" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "j_jobTitle=Senior+Web+Developer&j_salary=30000"
```

**Success (200):**
```json
{ "status": true, "message": "Job updated successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Update failed.

---

### POST `/api/team/jobs/:id/delete`

**Auth required:** Yes

**Path params:** `id` (int) — job id

**curl:**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/jobs/1/delete"
```

**Success (200):**
```json
{ "status": true, "message": "Job deleted successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Delete failed.

> Use POST, not DELETE — the route is a literal path, not an HTTP-method constraint.

---

## Events

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/events` | List events |
| POST | `/api/team/events/create` | Add event |

---

### GET `/api/team/events`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/events"
```

**Success (200) — keys in `data`:** `categories` (array), `events` (array).

```json
{
  "status": true,
  "message": "Events list",
  "data": { "categories": [], "events": [] }
}
```

---

### POST `/api/team/events/create`

Fields read by `Admin_model->eventspro()` from `$_POST`.

**Auth required:** Yes

**curl (form-encoded):**
```bash
curl -b cookies.txt -X POST "https://example.com/api/team/events/create" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=Franchise+Expo+2026&date=2026-10-15&venue=Lahore+Expo+Center"
```

**Success (201):**
```json
{ "status": true, "message": "Event added successfully", "data": true }
```

**Errors:** `401` = no or expired session, `500` = Error in insertion.

---

## Downloads

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/downloads` | List downloads |

---

### GET `/api/team/downloads`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/downloads"
```

**Success (200) — keys in `data`:** `categories` (array), `download` (array — note the
singular key name).

```json
{
  "status": true,
  "message": "Downloads list",
  "data": { "categories": [], "download": [] }
}
```

---

## Franchise

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/franchise` | List franchise listings |

---

### GET `/api/team/franchise`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/franchise"
```

**Success (200) — keys in `data`:** `categories` (array), `franchise` (array).

```json
{
  "status": true,
  "message": "Franchise list",
  "data": { "categories": [], "franchise": [] }
}
```

---

## Requests

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/requests` | Leads assigned to the logged-in employee |
| GET | `/api/team/requests/:id` | Lead detail (minimal) |
| GET | `/api/team/requests/:id/company/:company_id` | Lead detail + posting company |
| GET | `/api/team/requests/:id/company/:company_id/emp/:emp_id` | Lead detail + company + employee vCard |

All three detail routes call the same method. The extra segments opt into two more
lookups. The order matters — `company_id` always comes before `emp_id`, so the
shortest form is `/api/team/requests/:id`.

---

### GET `/api/team/requests`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/requests"
```

**Success (200) — keys in `data`:** `categories` (array), `requests` (array, scoped to `emp_id`).

```json
{
  "status": true,
  "message": "Requests list",
  "data": { "categories": [], "requests": [] }
}
```

---

### GET `/api/team/requests/:id`

**Auth required:** Yes

**Path params:** `id` (int) — lead id

**Success (200) — keys in `data`:**
| Key | Type | Source | Included when |
|-----|------|--------|---------------|
| `categories` | array | `home_m->get_categories()` | always |
| `requests` | object | `home_m->get_single_requests($id)` | always |
| `comments` | array | `home_m->get_lead_comments($id)` | always |
| `leads_detail` | object | `Admin_model->get_leads_detail($id)` | always |
| `lead_id` | int | echo of `:id` | always |
| `company` | object | `Admin_model->get_company_poster($company_id)` | `company_id` given |
| `login` | object | `Admin_model->get_vcard($emp_id)` | `emp_id` given |

**curl (minimal):**
```bash
curl -b cookies.txt "https://example.com/api/team/requests/12"
```

**curl (with company):**
```bash
curl -b cookies.txt "https://example.com/api/team/requests/12/company/1115"
```

**curl (with company and vCard):**
```bash
curl -b cookies.txt "https://example.com/api/team/requests/12/company/1115/emp/5"
```

**Example:** `GET /api/team/requests/12`

```json
{
  "status": true,
  "message": "Single request details",
  "data": {
    "categories": [],
    "requests": {},
    "comments": [],
    "leads_detail": {},
    "lead_id": 12
  }
}
```

**Errors:** `401` = no or expired session.

---

## Investor Requests

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/investor-requests` | List investor enquiries |

---

### GET `/api/team/investor-requests`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/investor-requests"
```

**Success (200) — keys in `data`:** `categories` (array), `investrequests` (array).

```json
{
  "status": true,
  "message": "Investor requests",
  "data": { "categories": [], "investrequests": [] }
}
```

---

## Advertisements

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/advertisements` | List adverts |

---

### GET `/api/team/advertisements`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/advertisements"
```

**Success (200) — keys in `data`:** `categories` (array), `adverts` (array).

```json
{
  "status": true,
  "message": "Advertisements list",
  "data": { "categories": [], "adverts": [] }
}
```

---

## Subscribers

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/team/subscribers` | List newsletter subscribers |

---

### GET `/api/team/subscribers`

**Auth required:** Yes

**curl:**
```bash
curl -b cookies.txt "https://example.com/api/team/subscribers"
```

**Success (200) — keys in `data`:** `categories` (array), `subs` (array).

```json
{
  "status": true,
  "message": "Subscribers list",
  "data": { "categories": [], "subs": [] }
}
```

> To email these subscribers, use `POST /api/admin/email/subscribers` from
> [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).

---

## Error Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (comments, reports, brands, properties, companies, jobs, events) |
| `400` | Bad request / missing required field / `field` not in the whitelist |
| `401` | Unauthorized — no session, or `user_id` absent from the session |
| `404` | Not found (company, employee) |
| `409` | Conflict — company name already registered |
| `500` | Server error — the model rejected the write |

**401 is the one to handle carefully.** It means the `ci_session` cookie is missing,
expired (2-hour lifetime), or was issued by a different login endpoint. A successful
`POST /api/team/auth/login` sets both `emp_id` and `user_id`; if you built the session
by some other route, `check_session()` will not see `user_id` and every endpoint
returns 401.

---

## Worked Example

Full employee flow: login → dashboard → pick a task → comment → close it → logout.

```bash
# 1. Login — saves the session cookie
curl -i -c cookies.txt -X POST "https://example.com/api/team/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@franchisepk.com","password":"secret123"}'

# 2. Dashboard counts
curl -b cookies.txt "https://example.com/api/team/dashboard"

# 3. Open tasks
curl -b cookies.txt "https://example.com/api/team/tasks?status=0"

# 4. Task detail — task, assignment, comments, employee dropdown
curl -b cookies.txt "https://example.com/api/team/tasks/12"

# 5. Comment on it
curl -b cookies.txt -X POST "https://example.com/api/team/tasks/12/comments" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Called, no answer"}'

# 6. Close the assignment (34 is the assign_id, not the task id)
curl -b cookies.txt -X POST "https://example.com/api/team/tasks/34/status" \
  -H "Content-Type: application/json" \
  -d '{"status":1,"taskid":12}'

# 7. Leads assigned to this employee, one with its posting company
curl -b cookies.txt "https://example.com/api/team/requests"
curl -b cookies.txt "https://example.com/api/team/requests/12/company/1115"

# 8. Logout — destroys the session
curl -b cookies.txt -X POST "https://example.com/api/team/auth/logout"
```

---

## Notes and Constraints

### Write endpoints read `$_POST`, not the JSON body

Most write endpoints pass straight through to a model that reads `$this->input->post()`.
The models are on the app server and were written for HTML forms, so they never call
`json_input()`. The controller only merges JSON for the fields it reads itself.

Send these as `application/x-www-form-urlencoded` or `multipart/form-data`, or the
model sees an empty body and the write silently no-ops:

| Endpoint | Reads JSON too? |
|----------|------------------|
| `POST /api/team/auth/login` | Yes — `email`, `password` |
| `POST /api/team/tasks/:id/comments` | Yes — `task_id` |
| `POST /api/team/tasks/:assign_id/status` | Yes — `status`, `taskid` |
| `POST /api/team/properties/status` | **No** — `id`, `field`, `status` are `$_POST` only |
| `POST /api/team/users/:id/update` | **No** — every field is `$_POST` only |
| `POST /api/team/companies/create` | **No** — plus `$_FILES` for images |
| `POST /api/team/brands/*`, `/reports/*`, `/properties/create`, `/jobs/*`, `/events/create` | **No** — `$_POST` only |

### Other behaviours worth knowing

- **`task_status` previously redirected.** The web controller called `redirect()`,
  which exits before any JSON is emitted. On the API it returns a normal 200 JSON body
  now, so the response is always parseable.
- **`jobs_create` previously always returned 201.** The model's return value was
  assigned and never checked. It now returns 500 on failure like its siblings.
- **`users_update` forces `status` and `payment_status` to `'0'`.** Not a bug you can
  work around from the client — the handler hardcodes both.
- **`properties/status` whitelists `field`.** Only `pipeline` and `deal_done` are
  accepted; anything else is a 400. This is deliberate.
- **`emp_special` branches in the web UI only.** The web `Team` controller redirects
  admin-tier employees to `Team/...` and others to `Admin/...`. The API has no such
  branch — a `team_special` employee gets the same JSON and the same
  `emp_id`-scoped queries.
- **All endpoints load 13 models.** `TeamApi::load_models()` is called per request,
  which is heavier than needed, but it is what keeps each method self-contained.
- **No pagination anywhere.** Every list endpoint returns the full result set. Filter
  client-side, or ask the server team to add limits.
- **`me` returns one row of the shared employee list.** It filters
  `get_emploeelist()` by `u_id`, so the response shape matches the `employee` key
  already returned by `task_details`. It is a linear scan, not an indexed lookup.

### Model call verification

The models live on the app server — `application/models/` is empty in this repo — so
their contents could not be read. What *could* be verified is whether each method call
in `TeamApi.php` also appears in a controller that predates this API (`Api.php`,
`UserpanelApi.php`, `User.php`, `Team.php`, `home.php`). A match proves the method
name is real. It does not prove the argument list.

**51 distinct model calls across the 38 endpoints. 49 are attested. 2 are not:**

| Endpoint | Model call | Status |
|----------|-----------|--------|
| `POST /api/team/jobs/create` | `Admin_model->add()` | **Unverified.** The only other reference is commented out at `Team.php:1553`. |
| `POST /api/team/events/create` | `Admin_model->eventspro()` | **Name attested on a sibling model** — `User_model->eventspro()` is live at `UserpanelApi.php`. The `Admin_model` variant's only other reference is commented out at `Team.php:1347`. |

Both were already in `TeamApi.php` before this API was wrapped. If either 500s on
first call, check those two method names against the server-side `Admin_model`.

Two more are attested by name but with an unverified argument list, because the only
live call site is inside this file:

| Endpoint | Model call | Note |
|----------|-----------|------|
| `POST /api/team/tasks/:id/comments` | `Admin_model->add_taskcomment()` | Takes no arguments, matching `Team.php:213` exactly. The controller injects `$_POST['task_id']` so the model finds the id. |
| `POST /api/team/tasks/:assign_id/status` | `Admin_model->task_status($assign_id, $status)` | Two arguments, matching `Team.php:269` exactly. |

Route coverage and method arities were verified with a script that resolves every
`api/team` route to its target method: 41 routes, 38 public methods, 0 unresolved,
0 arity mismatches.
