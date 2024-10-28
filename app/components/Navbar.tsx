export default function Navbar() {
    return (
      <div className="fixed bottom-[32px] left-[32px] z-50 w-full md:w-auto">
        <nav>
          <ul className="font-medium flex p-4 md:p-0 mt-4 border border-black rounded-lg bg-gray-50 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 md:bg-white dark:bg-black md:dark:bg-black">
            <li>
              <a
                onClick={() => {
                  window.open("https://docs.simli.com/introduction");
                }}
                className="block cursor-pointer py-2 px-3 text-gray-900 rounded   md:border-0 md:p-0 dark:text-white hover:underline    "
              >
                Documentation
              </a>
            </li>
            <li>
              <a
                onClick={() => {
                  window.open("https://simli.com");
                }}
                className="block cursor-pointer py-2 px-3 text-gray-900 rounded   md:border-0  md:p-0 dark:text-white hover:underline    "
              >
                Billing
              </a>
            </li>
            <li>
              <a
                onClick={() => {
                  window.open("https://discord.gg/yQx49zNF4d");
                }}
                className="block cursor-pointer py-2 px-3 text-gray-900 rounded   md:border-0  md:p-0 dark:text-white hover:underline    "
              >
                Discord
              </a>
            </li>
          </ul>
        </nav>
      </div>
    );
  }
  