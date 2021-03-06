import "css.escape";

const defaultOpts = {
  // required opts
  appOptions: null,
  template: null,

  // sometimes require opts
  Vue: null,
  createApp: null,
  handleInstance: null
};

export default function singleSpaVue(userOpts) {
  if (typeof userOpts !== "object") {
    throw new Error(`single-spa-vue requires a configuration object`);
  }

  const opts = {
    ...defaultOpts,
    ...userOpts
  };

  if (!opts.Vue && !opts.createApp) {
    throw Error("single-spa-vue must be passed opts.Vue or opts.createApp");
  }

  if (!opts.appOptions) {
    throw Error("single-spa-vue must be passed opts.appOptions");
  }

  if (
    opts.appOptions.el &&
    typeof opts.appOptions.el !== "string" &&
    !(opts.appOptions.el instanceof HTMLElement)
  ) {
    throw Error(
      `single-spa-vue: appOptions.el must be a string CSS selector, an HTMLElement, or not provided at all. Was given ${typeof opts
        .appOptions.el}`
    );
  }

  opts.createApp = opts.createApp || (opts.Vue && opts.Vue.createApp);

  // Just a shared object to store the mounted object state
  // key - name of single-spa app, since it is unique
  let mountedInstances = {};

  return {
    bootstrap: bootstrap.bind(null, opts, mountedInstances),
    mount: mount.bind(null, opts, mountedInstances),
    unmount: unmount.bind(null, opts, mountedInstances),
    update: update.bind(null, opts, mountedInstances)
  };
}

function bootstrap(opts) {
  if (opts.loadRootComponent) {
    return opts.loadRootComponent().then(root => (opts.rootComponent = root));
  } else {
    return Promise.resolve();
  }
}

function mount(opts, mountedInstances, props) {
  let instance = mountedInstances[props.name];
  return Promise.resolve().then(() => {
    //先判断是否已加载，如果是，则直接将其显示出来
    if (!instance) {
      //这里面都是其源码，生成DOM并实例化vue的部分
      instance = {};
      const appOptions = { ...opts.appOptions };
      if (props.domElement && !appOptions.el) {
        appOptions.el = props.domElement;
      }
      let domEl;
      if (appOptions.el) {
        if (typeof appOptions.el === "string") {
          domEl = document.querySelector(appOptions.el);
          if (!domEl) {
            throw Error(
              `If appOptions.el is provided to single-spa-vue, the dom element must
  exist in the dom. Was provided as ${appOptions.el}`
            );
          }
        } else {
          domEl = appOptions.el;
        }
      } else {
        const htmlId = `single-spa-application:${props.name}`;
        // CSS.escape 的文档（需考虑兼容性）
        // https://developer.mozilla.org/zh-CN/docs/Web/API/CSS/escape
        appOptions.el = `#${CSS.escape(htmlId)}`;
        domEl = document.getElementById(htmlId);
        if (!domEl) {
          domEl = document.createElement("div");
          domEl.id = htmlId;
          document.body.appendChild(domEl);
        }
      }
      appOptions.el = appOptions.el + " .single-spa-container";
      // single-spa-vue@>=2 always REPLACES the `el` instead of appending to it.
      // We want domEl to stick around and not be replaced. So we tell Vue to mount
      // into a container div inside of the main domEl
      if (!domEl.querySelector(".single-spa-container")) {
        const singleSpaContainer = document.createElement("div");
        singleSpaContainer.className = "single-spa-container";
        domEl.appendChild(singleSpaContainer);
      }
      instance.domEl = domEl;
      if (!appOptions.render && !appOptions.template && opts.rootComponent) {
        appOptions.render = h => h(opts.rootComponent);
      }
      if (!appOptions.data) {
        appOptions.data = {};
      }
      appOptions.data = { ...appOptions.data, ...props };
      instance.vueInstance = new opts.Vue(appOptions);
      if (instance.vueInstance.bind) {
        instance.vueInstance = instance.vueInstance.bind(instance.vueInstance);
      }
      mountedInstances[props.name] = instance;
    } else {
      instance.vueInstance.$el.style.display = "block";
    }
    return instance.vueInstance;
  });
}

function update(opts, mountedInstances, props) {
  return Promise.resolve().then(() => {
    const instance = mountedInstances[props.name];
    const data = {
      ...(opts.appOptions.data || {}),
      ...props
    };
    for (let prop in data) {
      instance.vueInstance[prop] = data[prop];
    }
  });
}

function unmount(opts, mountedInstances, props) {
  return Promise.resolve().then(() => {
    const instance = mountedInstances[props.name];
    instance.vueInstance.$el.style.display = "none";
  });
}
