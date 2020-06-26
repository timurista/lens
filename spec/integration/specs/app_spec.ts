import { Application } from "spectron"
import * as util from "../helpers/utils"
import { spawnSync } from "child_process"
import { stat } from "fs"

jest.setTimeout(20000)

const BACKSPACE = "\uE003"

describe("app start", () => {
  let app: Application
  const clickWhatsNew = async (app: Application) => {
    await app.client.waitUntilTextExists("h1", "What's new")
    await app.client.click("button.btn-primary")
    await app.client.waitUntilTextExists("h1", "Welcome")
  }

  const addMinikubeCluster = async (app: Application) => {
    await app.client.click("a#add-cluster")
    console.log("Add cluster clicked")
    await app.client.waitUntilTextExists("legend", "Choose config:")
    console.log("Choose config visible")
    await app.client.selectByVisibleText("select#kubecontext-select", "minikube (new)")
    console.log("minikube (new added)")
    await app.client.click("button.btn-primary")
  }

  const waitForMinikubeDashboard = async (app: Application) => {
    await app.client.waitUntilTextExists("pre.auth-output", "Authentication proxy started")
    console.log("Authentication proxy started seen")
    let windowCount = await app.client.getWindowCount()
    console.log("Window count "+windowCount)
    // wait for webview to appear on window count
    while (windowCount == 1) {
      windowCount = await app.client.getWindowCount()
    }
    console.log("Webview appeared")
    await app.client.windowByIndex(windowCount - 1)
    console.log("Webview focused")
    setTimeout(() => {
      console.log(app.client.element("pre.auth-output").getHTML())
    }, 9000);
    await app.client.waitUntilTextExists("span.link-text", "Cluster")
    console.log("Cluster text found")
  }

  beforeEach(async () => {
    app = util.setup()
    await app.start()
    const windowCount = await app.client.getWindowCount()
    await app.client.windowByIndex(windowCount - 1)
    await app.client.waitUntilWindowLoaded()
  }, 20000)

  it('shows "whats new"', async () => {
    await clickWhatsNew(app)
  })

  it('allows to add a cluster', async () => {
    const status = spawnSync("minikube status", {shell: true})
    if (status.status !== 0) {
      console.warn("minikube not running, skipping test")
      return
    }
    console.log(status.status)
    console.log(status.stdout.toString())
    console.log(status.stderr.toString())
    await clickWhatsNew(app)
    console.log("What's new found")
    await addMinikubeCluster(app)
    console.log("Minikube cluster added")
    await waitForMinikubeDashboard(app)
    console.log("Minikube dashboard visible")
    await app.client.click('a[href="/nodes"]')
    console.log("Nodes clicked")
    await app.client.waitUntilTextExists("div.TableCell", "minikube")
    console.log("Minikube node visible")
  })

  it('allows to create a pod', async () => {
    const status = spawnSync("minikube status", {shell: true})
    if (status.status !== 0) {
      console.warn("minikube not running, skipping test")
      return
    }
    await clickWhatsNew(app)
    await addMinikubeCluster(app)
    await waitForMinikubeDashboard(app)
    await app.client.click(".sidebar-nav #workloads span.link-text")
    await app.client.waitUntilTextExists('a[href="/pods"]', "Pods")
    await app.client.click('a[href="/pods"]')
    await app.client.waitUntilTextExists("div.TableCell", "kube-apiserver-minikube")
    await app.client.click('.Icon.new-dock-tab')
    await app.client.waitUntilTextExists("li.MenuItem.create-resource-tab", "Create resource")
    await app.client.click("li.MenuItem.create-resource-tab")
    await app.client.waitForVisible(".CreateResource div.ace_content")
    // Write pod manifest to editor
    await app.client.keys("apiVersion: v1\n")
    await app.client.keys("kind: Pod\n")
    await app.client.keys("metadata:\n")
    await app.client.keys("  name: nginx\n")
    await app.client.keys(BACKSPACE + "spec:\n")
    await app.client.keys("  containers:\n")
    await app.client.keys("- name: nginx\n")
    await app.client.keys("  image: nginx:alpine\n")
    // Create deployent
    await app.client.waitForEnabled("button.Button=Create & Close")
    await app.client.click("button.Button=Create & Close")
    // Wait until first bits of pod appears on dashboard
    await app.client.waitForExist(".name=nginx")
    // Open pod details
    await app.client.click(".name=nginx")
    await app.client.waitUntilTextExists("div.drawer-title-text", "Pod: nginx")
  })

  afterEach(async () => {
    if (app && app.isRunning()) {
      return util.tearDown(app)
    }
  })
})
